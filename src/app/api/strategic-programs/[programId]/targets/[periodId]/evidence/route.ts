import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { uploadFileWithKey } from "@/lib/storage";
import {
  requirePlanWriteByProgram,
  type RouteParams,
} from "@/lib/strategic-api";

function safeFilename(name: string) {
  return (
    name
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120) || "evidence"
  );
}

export async function POST(
  request: Request,
  { params }: RouteParams<{ programId: string; periodId: string }>,
) {
  try {
    const { programId, periodId } = await params;
    const guard = await requirePlanWriteByProgram(programId);
    if ("error" in guard) return guard.error;
    const plan = (guard as { plan: { id: string } }).plan;
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File))
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    if (file.size > 10 * 1024 * 1024)
      return NextResponse.json(
        { error: "File must be 10MB or smaller" },
        { status: 400 },
      );
    const target = await queryOne<{ id: string }>(
      `SELECT ppt.id FROM program_period_targets ppt
       JOIN strategic_periods sp ON sp.id = ppt.period_id
       WHERE ppt.program_id = $1 AND ppt.period_id = $2 AND sp.plan_id = $3`,
      [programId, periodId, plan.id],
    );
    if (!target)
      return NextResponse.json(
        { error: "Target does not belong to this program and plan" },
        { status: 400 },
      );
    const buffer = Buffer.from(await file.arrayBuffer());
    const key = `strategic-plans/${plan.id}/${programId}/${periodId}/${Date.now()}-${safeFilename(file.name)}`;
    await uploadFileWithKey(
      buffer,
      key,
      file.type || "application/octet-stream",
    );
    const updated = await queryOne(
      "UPDATE program_period_targets SET evidence_key = $1, updated_at = now() WHERE id = $2 RETURNING *",
      [key, target.id],
    );
    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("Strategic evidence upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload evidence" },
      { status: 500 },
    );
  }
}
