import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import {
  canDeleteStrategicPlan,
  canReadStrategicPlan,
  canWriteStrategicPlan,
  fetchPlanTree,
  getPlanAccessRow,
  toInt,
} from "@/lib/strategic-plans";

type Params = { params: Promise<{ planId: string }> };

function sessionUser(session: any) {
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    roles: (session.user as { roles?: string[] }).roles ?? [],
    departmentId:
      (session.user as { departmentId?: string | null }).departmentId ?? null,
  };
}

export async function GET(_: Request, { params }: Params) {
  try {
    const session = await auth();
    const user = sessionUser(session);
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { planId } = await params;
    const plan = await getPlanAccessRow(planId);
    if (!plan)
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    if (!(await canReadStrategicPlan(plan, user)))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ data: await fetchPlanTree(planId) });
  } catch (error) {
    console.error("Strategic plan detail error:", error);
    return NextResponse.json(
      { error: "Failed to fetch strategic plan" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const session = await auth();
    const user = sessionUser(session);
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { planId } = await params;
    const plan = await getPlanAccessRow(planId);
    if (!plan)
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    if (!(await canWriteStrategicPlan(plan, user)))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const startYear = body.startYear ?? body.start_year;
    const parsedStartYear =
      startYear === undefined ? null : toInt(startYear, 0);
    if (
      parsedStartYear !== null &&
      (parsedStartYear < 2000 || parsedStartYear > 2100)
    )
      return NextResponse.json(
        { error: "startYear must be between 2000 and 2100" },
        { status: 400 },
      );

    const updated = await queryOne(
      `UPDATE strategic_plans
       SET name = COALESCE($1, name), description = $2, vision = $3, mission = $4,
           start_year = COALESCE($5, start_year), end_year = COALESCE($6, end_year), updated_at = now()
       WHERE id = $7 RETURNING *`,
      [
        body.name ?? null,
        body.description ?? null,
        body.vision ?? null,
        body.mission ?? null,
        parsedStartYear,
        parsedStartYear === null ? null : parsedStartYear + 4,
        planId,
      ],
    );
    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("Strategic plan update error:", error);
    return NextResponse.json(
      { error: "Failed to update strategic plan" },
      { status: 500 },
    );
  }
}

export async function DELETE(_: Request, { params }: Params) {
  try {
    const session = await auth();
    const user = sessionUser(session);
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canDeleteStrategicPlan(user))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { planId } = await params;
    await query("DELETE FROM strategic_plans WHERE id = $1", [planId]);
    return NextResponse.json({ message: "Strategic plan deleted" });
  } catch (error) {
    console.error("Strategic plan delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete strategic plan" },
      { status: 500 },
    );
  }
}
