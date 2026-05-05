import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { requirePlanWriteByGoal, type RouteParams } from "@/lib/strategic-api";

export async function POST(request: Request, { params }: RouteParams<{ goalId: string }>) {
  try {
    const { goalId } = await params;
    const guard = await requirePlanWriteByGoal(goalId);
    if ("error" in guard) return guard.error;
    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) return NextResponse.json({ error: "Objective title is required" }, { status: 400 });
    const meta = await queryOne<{ next_order: string }>("SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM strategic_objectives WHERE goal_id = $1", [goalId]);
    const sortOrder = Number(meta?.next_order ?? 1);
    const objective = await queryOne("INSERT INTO strategic_objectives (id, goal_id, number, title, sort_order) VALUES ($1, $2, $3, $4, $5) RETURNING *", [randomUUID(), goalId, sortOrder, title, sortOrder]);
    return NextResponse.json({ data: objective }, { status: 201 });
  } catch (error) {
    console.error("Create objective error:", error);
    return NextResponse.json({ error: "Failed to create objective" }, { status: 500 });
  }
}
