import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { requirePlanWriteByPlan, type RouteParams } from "@/lib/strategic-api";

export async function POST(request: Request, { params }: RouteParams<{ planId: string }>) {
  try {
    const { planId } = await params;
    const guard = await requirePlanWriteByPlan(planId);
    if ("error" in guard) return guard.error;
    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) return NextResponse.json({ error: "Goal title is required" }, { status: 400 });
    const meta = await queryOne<{ next_order: string }>("SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM strategic_goals WHERE plan_id = $1", [planId]);
    const sortOrder = Number(meta?.next_order ?? 1);
    const goal = await queryOne(
      `INSERT INTO strategic_goals (id, plan_id, number, title, description, sort_order) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [randomUUID(), planId, sortOrder, title, body.description ?? null, sortOrder],
    );
    return NextResponse.json({ data: goal }, { status: 201 });
  } catch (error) {
    console.error("Create goal error:", error);
    return NextResponse.json({ error: "Failed to create goal" }, { status: 500 });
  }
}
