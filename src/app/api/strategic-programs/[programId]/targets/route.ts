import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requirePlanWriteByProgram, type RouteParams } from "@/lib/strategic-api";
import { validProgramStatus } from "@/lib/strategic-plans";

export async function PUT(request: Request, { params }: RouteParams<{ programId: string }>) {
  try {
    const { programId } = await params;
    const guard = await requirePlanWriteByProgram(programId);
    if ("error" in guard) return guard.error;
    const body = await request.json();
    const targets = Array.isArray(body.targets) ? body.targets : [];
    for (const target of targets) {
      if (target.status !== undefined && !validProgramStatus(target.status)) return NextResponse.json({ error: "Invalid period target status" }, { status: 400 });
      await query(
        `UPDATE program_period_targets SET target_text = COALESCE($1, target_text), actual_text = $2, status = COALESCE($3::"ProgramStatus", status), updated_at = now()
         WHERE program_id = $4 AND period_id = $5`,
        [target.target_text ?? target.targetText ?? null, target.actual_text ?? target.actualText ?? null, target.status ?? null, programId, target.period_id ?? target.periodId],
      );
    }
    const rows = await query("SELECT ppt.*, sp.label AS period_label, sp.year AS period_year FROM program_period_targets ppt JOIN strategic_periods sp ON sp.id = ppt.period_id WHERE ppt.program_id = $1 ORDER BY sp.sort_order", [programId]);
    return NextResponse.json({ data: rows });
  } catch (error) {
    console.error("Targets update error:", error);
    return NextResponse.json({ error: "Failed to update targets" }, { status: 500 });
  }
}
