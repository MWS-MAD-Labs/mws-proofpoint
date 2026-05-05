import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { requirePlanWriteByPlan, type RouteParams } from "@/lib/strategic-api";

export async function POST(_: Request, { params }: RouteParams<{ planId: string }>) {
  try {
    const { planId } = await params;
    const guard = await requirePlanWriteByPlan(planId);
    if ("error" in guard) return guard.error;
    const counts = await queryOne<{ goals: string; objectives: string; programs: string }>(
      `SELECT COUNT(DISTINCT sg.id) AS goals, COUNT(DISTINCT so.id) AS objectives, COUNT(DISTINCT spr.id) AS programs
       FROM strategic_plans sp
       LEFT JOIN strategic_goals sg ON sg.plan_id = sp.id
       LEFT JOIN strategic_objectives so ON so.goal_id = sg.id
       LEFT JOIN strategic_programs spr ON spr.objective_id = so.id
       WHERE sp.id = $1`,
      [planId],
    );
    if (!counts || Number(counts.goals) < 1 || Number(counts.objectives) < 1 || Number(counts.programs) < 1) {
      return NextResponse.json({ error: "Publishing requires at least one goal, objective, and program" }, { status: 400 });
    }
    const plan = await queryOne("UPDATE strategic_plans SET status = 'published', published_at = COALESCE(published_at, now()), updated_at = now() WHERE id = $1 RETURNING *", [planId]);
    return NextResponse.json({ data: plan });
  } catch (error) {
    console.error("Publish plan error:", error);
    return NextResponse.json({ error: "Failed to publish plan" }, { status: 500 });
  }
}
