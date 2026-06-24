import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  canWriteStrategicPlan,
  getPlanAccessRow,
  getPlanAccessRowForGoal,
  getPlanAccessRowForObjective,
  getPlanAccessRowForProgram,
} from "@/lib/strategic-plans";

export type RouteParams<T extends Record<string, string>> = {
  params: Promise<T>;
};

export function sessionUser(session: any) {
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    roles: (session.user as { roles?: string[] }).roles ?? [],
    departmentId:
      (session.user as { departmentId?: string | null }).departmentId ?? null,
  };
}

export async function requireUser() {
  const session = await auth();
  const user = sessionUser(session);
  if (!user)
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    } as const;
  return { user } as const;
}

export async function requirePlanWriteByPlan(planId: string) {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult;
  const plan = await getPlanAccessRow(planId);
  if (!plan)
    return {
      error: NextResponse.json({ error: "Plan not found" }, { status: 404 }),
    } as const;
  if (!(await canWriteStrategicPlan(plan, authResult.user)))
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    } as const;
  return { user: authResult.user, plan } as const;
}

export async function requirePlanWriteByGoal(goalId: string) {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult;
  const plan = await getPlanAccessRowForGoal(goalId);
  if (!plan)
    return {
      error: NextResponse.json({ error: "Goal not found" }, { status: 404 }),
    } as const;
  if (!(await canWriteStrategicPlan(plan, authResult.user)))
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    } as const;
  return { user: authResult.user, plan } as const;
}

export async function requirePlanWriteByObjective(objectiveId: string) {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult;
  const plan = await getPlanAccessRowForObjective(objectiveId);
  if (!plan)
    return {
      error: NextResponse.json(
        { error: "Objective not found" },
        { status: 404 },
      ),
    } as const;
  if (!(await canWriteStrategicPlan(plan, authResult.user)))
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    } as const;
  return { user: authResult.user, plan } as const;
}

export async function requirePlanWriteByProgram(programId: string) {
  const authResult = await requireUser();
  if ("error" in authResult) return authResult;
  const plan = await getPlanAccessRowForProgram(programId);
  if (!plan)
    return {
      error: NextResponse.json({ error: "Program not found" }, { status: 404 }),
    } as const;
  if (!(await canWriteStrategicPlan(plan, authResult.user)))
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    } as const;
  return { user: authResult.user, plan } as const;
}
