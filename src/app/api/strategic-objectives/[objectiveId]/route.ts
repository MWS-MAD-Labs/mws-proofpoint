import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requirePlanWriteByObjective, type RouteParams } from "@/lib/strategic-api";

export async function PATCH(request: Request, { params }: RouteParams<{ objectiveId: string }>) {
  try {
    const { objectiveId } = await params;
    const guard = await requirePlanWriteByObjective(objectiveId);
    if ("error" in guard) return guard.error;
    const body = await request.json();
    const objective = await queryOne("UPDATE strategic_objectives SET title = COALESCE($1, title) WHERE id = $2 RETURNING *", [body.title ?? null, objectiveId]);
    return NextResponse.json({ data: objective });
  } catch (error) {
    console.error("Update objective error:", error);
    return NextResponse.json({ error: "Failed to update objective" }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: RouteParams<{ objectiveId: string }>) {
  try {
    const { objectiveId } = await params;
    const guard = await requirePlanWriteByObjective(objectiveId);
    if ("error" in guard) return guard.error;
    await query("DELETE FROM strategic_objectives WHERE id = $1", [objectiveId]);
    return NextResponse.json({ message: "Objective deleted" });
  } catch (error) {
    console.error("Delete objective error:", error);
    return NextResponse.json({ error: "Failed to delete objective" }, { status: 500 });
  }
}
