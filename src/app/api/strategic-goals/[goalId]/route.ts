import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requirePlanWriteByGoal, type RouteParams } from "@/lib/strategic-api";

export async function PATCH(request: Request, { params }: RouteParams<{ goalId: string }>) {
  try {
    const { goalId } = await params;
    const guard = await requirePlanWriteByGoal(goalId);
    if ("error" in guard) return guard.error;
    const body = await request.json();
    const goal = await queryOne("UPDATE strategic_goals SET title = COALESCE($1, title), description = $2 WHERE id = $3 RETURNING *", [body.title ?? null, body.description ?? null, goalId]);
    return NextResponse.json({ data: goal });
  } catch (error) {
    console.error("Update goal error:", error);
    return NextResponse.json({ error: "Failed to update goal" }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: RouteParams<{ goalId: string }>) {
  try {
    const { goalId } = await params;
    const guard = await requirePlanWriteByGoal(goalId);
    if ("error" in guard) return guard.error;
    await query("DELETE FROM strategic_goals WHERE id = $1", [goalId]);
    return NextResponse.json({ message: "Goal deleted" });
  } catch (error) {
    console.error("Delete goal error:", error);
    return NextResponse.json({ error: "Failed to delete goal" }, { status: 500 });
  }
}
