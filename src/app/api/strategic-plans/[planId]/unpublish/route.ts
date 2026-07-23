import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { requirePlanWriteByPlan, type RouteParams } from "@/lib/strategic-api";

export async function POST(_: Request, { params }: RouteParams<{ planId: string }>) {
  try {
    const { planId } = await params;
    const guard = await requirePlanWriteByPlan(planId);
    if ("error" in guard) return guard.error;
    const plan = await queryOne("UPDATE strategic_plans SET status = 'draft', updated_at = now() WHERE id = $1 RETURNING *", [planId]);
    return NextResponse.json({ data: plan });
  } catch (error) {
    console.error("Unpublish plan error:", error);
    return NextResponse.json({ error: "Failed to unpublish plan" }, { status: 500 });
  }
}
