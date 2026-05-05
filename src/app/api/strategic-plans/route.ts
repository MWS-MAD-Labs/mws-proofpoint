import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";
import {
  canCreateStrategicPlan,
  canReadStrategicPlan,
  createPlanWithPeriods,
  toInt,
  type StrategicPlanRow,
  type StrategicSessionUser,
} from "@/lib/strategic-plans";

type StrategicPlanSession = {
  user?: {
    id?: string;
    roles?: string[];
    departmentId?: string | null;
  };
} | null;

function sessionUser(
  session: StrategicPlanSession,
): StrategicSessionUser | null {
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    roles: session.user.roles ?? [],
    departmentId: session.user.departmentId ?? null,
  };
}

export async function GET() {
  try {
    const session = await auth();
    const user = sessionUser(session);
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const plans = await query(
      `SELECT sp.*, d.name AS department_name, p.full_name AS owner_name,
              COUNT(DISTINCT sg.id) AS goal_count,
              COUNT(DISTINCT spr.id) AS program_count,
              COUNT(DISTINCT spr.id) FILTER (WHERE spr.status = 'completed') AS completed_program_count
       FROM strategic_plans sp
       JOIN departments d ON d.id = sp.department_id
       LEFT JOIN profiles p ON p.user_id = sp.owner_user_id
       LEFT JOIN strategic_goals sg ON sg.plan_id = sp.id
       LEFT JOIN strategic_objectives so ON so.goal_id = sg.id
       LEFT JOIN strategic_programs spr ON spr.objective_id = so.id
       GROUP BY sp.id, d.name, p.full_name
       ORDER BY d.name`,
    );

    const visible = [];
    for (const plan of plans as (StrategicPlanRow &
      Record<string, unknown>)[]) {
      if (await canReadStrategicPlan(plan, user)) visible.push(plan);
    }
    return NextResponse.json({ data: visible });
  } catch (error) {
    console.error("Strategic plans list error:", error);
    return NextResponse.json(
      { error: "Failed to fetch strategic plans" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    const user = sessionUser(session);
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const departmentId =
      (typeof body.departmentId === "string"
        ? body.departmentId
        : body.department_id) || user.departmentId;
    const startYear = toInt(
      body.startYear ?? body.start_year,
      new Date().getFullYear(),
    );
    const defaultName = `${startYear}–${startYear + 4} Strategic Plan`;
    const name =
      typeof body.name === "string" && body.name.trim()
        ? body.name.trim()
        : defaultName;

    if (!departmentId)
      return NextResponse.json(
        { error: "departmentId is required" },
        { status: 400 },
      );
    if (startYear < 2000 || startYear > 2100)
      return NextResponse.json(
        { error: "startYear must be between 2000 and 2100" },
        { status: 400 },
      );

    if (!(await canCreateStrategicPlan(departmentId, user))) {
      return NextResponse.json(
        {
          error:
            "You cannot create a strategic plan for this department, or one already exists",
        },
        { status: 403 },
      );
    }

    const plan = await createPlanWithPeriods({
      departmentId,
      name,
      startYear,
      description:
        typeof body.description === "string" ? body.description : null,
      vision: typeof body.vision === "string" ? body.vision : null,
      mission: typeof body.mission === "string" ? body.mission : null,
      ownerUserId: user.id,
    });
    return NextResponse.json({ data: plan }, { status: 201 });
  } catch (error: unknown) {
    console.error("Strategic plan create error:", error);
    const code = (error as { code?: string }).code;
    if (code === "23505")
      return NextResponse.json(
        { error: "This department already has a strategic plan" },
        { status: 409 },
      );
    return NextResponse.json(
      { error: "Failed to create strategic plan" },
      { status: 500 },
    );
  }
}
