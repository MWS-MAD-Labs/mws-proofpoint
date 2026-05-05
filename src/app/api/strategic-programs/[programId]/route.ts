import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { canReadStrategicPlan, fetchPlanTree, getPlanAccessRowForProgram, validProgramStatus } from "@/lib/strategic-plans";
import { requirePlanWriteByProgram, requireUser, type RouteParams } from "@/lib/strategic-api";

export async function GET(_: Request, { params }: RouteParams<{ programId: string }>) {
  try {
    const { programId } = await params;
    const authResult = await requireUser();
    if ("error" in authResult) return authResult.error;
    const plan = await getPlanAccessRowForProgram(programId);
    if (!plan) return NextResponse.json({ error: "Program not found" }, { status: 404 });
    if (!(await canReadStrategicPlan(plan, authResult.user))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const tree = await fetchPlanTree(plan.id);
    return NextResponse.json({ data: tree });
  } catch (error) {
    console.error("Program detail error:", error);
    return NextResponse.json({ error: "Failed to fetch program" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteParams<{ programId: string }>) {
  try {
    const { programId } = await params;
    const guard = await requirePlanWriteByProgram(programId);
    if ("error" in guard) return guard.error;
    const body = await request.json();
    const status = body.status === undefined ? null : body.status;
    if (status !== null && !validProgramStatus(status)) return NextResponse.json({ error: "Invalid program status" }, { status: 400 });
    const program = await queryOne(
      `UPDATE strategic_programs SET title = COALESCE($1, title), description = $2, status = COALESCE($3::"ProgramStatus", status), updated_at = now() WHERE id = $4 RETURNING *`,
      [body.title ?? null, body.description ?? null, status, programId],
    );
    return NextResponse.json({ data: program });
  } catch (error) {
    console.error("Update program error:", error);
    return NextResponse.json({ error: "Failed to update program" }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: RouteParams<{ programId: string }>) {
  try {
    const { programId } = await params;
    const guard = await requirePlanWriteByProgram(programId);
    if ("error" in guard) return guard.error;
    await query("DELETE FROM strategic_programs WHERE id = $1", [programId]);
    return NextResponse.json({ message: "Program deleted" });
  } catch (error) {
    console.error("Delete program error:", error);
    return NextResponse.json({ error: "Failed to delete program" }, { status: 500 });
  }
}
