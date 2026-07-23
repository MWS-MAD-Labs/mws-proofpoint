import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requirePlanWriteByObjective, type RouteParams } from "@/lib/strategic-api";
import { createProgramWithTargets } from "@/lib/strategic-plans";

export async function POST(request: Request, { params }: RouteParams<{ objectiveId: string }>) {
  const client = await pool.connect();
  try {
    const { objectiveId } = await params;
    const guard = await requirePlanWriteByObjective(objectiveId);
    if ("error" in guard) return guard.error;
    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) return NextResponse.json({ error: "Program title is required" }, { status: 400 });
    await client.query("BEGIN");
    const program = await createProgramWithTargets(client, objectiveId, title, typeof body.description === "string" ? body.description : null);
    await client.query("COMMIT");
    return NextResponse.json({ data: program }, { status: 201 });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create program error:", error);
    return NextResponse.json({ error: "Failed to create program" }, { status: 500 });
  } finally {
    client.release();
  }
}
