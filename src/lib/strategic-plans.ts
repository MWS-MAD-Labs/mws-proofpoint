import { randomUUID } from "crypto";
import type { PoolClient } from "pg";
import { pool, query, queryOne } from "@/lib/db";

export type ProgramStatus =
  | "not_started"
  | "on_track"
  | "at_risk"
  | "off_track"
  | "completed";
export const PROGRAM_STATUSES: ProgramStatus[] = [
  "not_started",
  "on_track",
  "at_risk",
  "off_track",
  "completed",
];

export interface StrategicSessionUser {
  id: string;
  roles?: string[];
  departmentId?: string | null;
}

export interface StrategicPlanRow {
  id: string;
  department_id: string;
  status: "draft" | "published";
}

export function hasAnyRole(
  user: StrategicSessionUser | undefined | null,
  roles: string[],
) {
  const userRoles = user?.roles ?? [];
  return roles.some((role) => userRoles.includes(role));
}

export async function isManagerOfDepartment(
  user: StrategicSessionUser | undefined | null,
  departmentId: string,
) {
  if (!user?.id || !(user.roles ?? []).includes("manager")) return false;

  const membership = await queryOne<{ allowed: boolean }>(
    `SELECT EXISTS (
       SELECT 1
         FROM department_role_memberships drm
         JOIN department_roles dr ON dr.id = drm.department_role_id
        WHERE drm.user_id = $1
          AND dr.role::text = 'manager'
          AND dr.department_id = $2
     ) AS allowed`,
    [user.id, departmentId],
  );
  return membership?.allowed ?? false;
}

export async function canReadStrategicPlan(
  plan: StrategicPlanRow,
  user: StrategicSessionUser | undefined | null,
) {
  if (!user?.id) return false;
  if (plan.status === "published") return true;
  if (hasAnyRole(user, ["director", "admin"])) return true;
  return isManagerOfDepartment(user, plan.department_id);
}

export async function canWriteStrategicPlan(
  plan: StrategicPlanRow,
  user: StrategicSessionUser | undefined | null,
) {
  if (!user?.id) return false;
  if (hasAnyRole(user, ["director", "admin"])) return true;
  return isManagerOfDepartment(user, plan.department_id);
}

export function canDeleteStrategicPlan(
  user: StrategicSessionUser | undefined | null,
) {
  return !!user?.id && hasAnyRole(user, ["director", "admin"]);
}

export async function canCreateStrategicPlan(
  departmentId: string,
  user: StrategicSessionUser | undefined | null,
) {
  if (!user?.id) return false;
  const existing = await queryOne<{ id: string }>(
    "SELECT id FROM strategic_plans WHERE department_id = $1",
    [departmentId],
  );
  if (existing) return false;
  if (hasAnyRole(user, ["director", "admin"])) return true;
  return isManagerOfDepartment(user, departmentId);
}

export async function getPlanAccessRow(planId: string) {
  return queryOne<StrategicPlanRow>(
    "SELECT id, department_id, status FROM strategic_plans WHERE id = $1",
    [planId],
  );
}

export async function getPlanAccessRowForGoal(goalId: string) {
  return queryOne<StrategicPlanRow>(
    `SELECT sp.id, sp.department_id, sp.status
     FROM strategic_plans sp
     JOIN strategic_goals sg ON sg.plan_id = sp.id
     WHERE sg.id = $1`,
    [goalId],
  );
}

export async function getPlanAccessRowForObjective(objectiveId: string) {
  return queryOne<StrategicPlanRow>(
    `SELECT sp.id, sp.department_id, sp.status
     FROM strategic_plans sp
     JOIN strategic_goals sg ON sg.plan_id = sp.id
     JOIN strategic_objectives so ON so.goal_id = sg.id
     WHERE so.id = $1`,
    [objectiveId],
  );
}

export async function getPlanAccessRowForProgram(programId: string) {
  return queryOne<StrategicPlanRow>(
    `SELECT sp.id, sp.department_id, sp.status
     FROM strategic_plans sp
     JOIN strategic_goals sg ON sg.plan_id = sp.id
     JOIN strategic_objectives so ON so.goal_id = sg.id
     JOIN strategic_programs spr ON spr.objective_id = so.id
     WHERE spr.id = $1`,
    [programId],
  );
}

export function validProgramStatus(value: unknown): value is ProgramStatus {
  return (
    typeof value === "string" &&
    PROGRAM_STATUSES.includes(value as ProgramStatus)
  );
}

export function toInt(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

export async function createPlanWithPeriods(input: {
  departmentId: string;
  name: string;
  description?: string | null;
  vision?: string | null;
  mission?: string | null;
  startYear: number;
  ownerUserId: string;
}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const endYear = input.startYear + 4;
    const id = randomUUID();
    const planResult = await client.query(
      `INSERT INTO strategic_plans (id, department_id, name, description, vision, mission, start_year, end_year, owner_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        id,
        input.departmentId,
        input.name,
        input.description ?? null,
        input.vision ?? null,
        input.mission ?? null,
        input.startYear,
        endYear,
        input.ownerUserId,
      ],
    );

    for (let index = 0; index < 5; index += 1) {
      const year = input.startYear + index;
      await client.query(
        `INSERT INTO strategic_periods (id, plan_id, label, year, sort_order) VALUES ($1, $2, $3, $4, $5)`,
        [randomUUID(), id, String(year), year, index + 1],
      );
    }
    await client.query("COMMIT");
    return planResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function createProgramWithTargets(
  client: PoolClient,
  objectiveId: string,
  title: string,
  description?: string | null,
) {
  const meta = await client.query<{ plan_id: string; next_order: number }>(
    `SELECT sg.plan_id, COALESCE(MAX(sp.sort_order), 0) + 1 AS next_order
     FROM strategic_objectives so
     JOIN strategic_goals sg ON sg.id = so.goal_id
     LEFT JOIN strategic_programs sp ON sp.objective_id = so.id
     WHERE so.id = $1
     GROUP BY sg.plan_id`,
    [objectiveId],
  );
  const row = meta.rows[0];
  if (!row) return null;
  const sortOrder = Number(row.next_order);
  const programId = randomUUID();
  const program = await client.query(
    `INSERT INTO strategic_programs (id, objective_id, code, title, description, status, sort_order)
     VALUES ($1, $2, $3, $4, $5, 'not_started'::"ProgramStatus", $6)
     RETURNING *`,
    [
      programId,
      objectiveId,
      `P${sortOrder}`,
      title,
      description ?? null,
      sortOrder,
    ],
  );
  const periods = await client.query<{ id: string }>(
    "SELECT id FROM strategic_periods WHERE plan_id = $1 ORDER BY sort_order",
    [row.plan_id],
  );
  for (const period of periods.rows) {
    await client.query(
      `INSERT INTO program_period_targets (id, program_id, period_id) VALUES ($1, $2, $3) ON CONFLICT (program_id, period_id) DO NOTHING`,
      [randomUUID(), programId, period.id],
    );
  }
  return program.rows[0];
}

export async function fetchPlanTree(planId: string) {
  const plan = await queryOne(
    `SELECT sp.*, d.name AS department_name, p.full_name AS owner_name
     FROM strategic_plans sp
     JOIN departments d ON d.id = sp.department_id
     LEFT JOIN profiles p ON p.user_id = sp.owner_user_id
     WHERE sp.id = $1`,
    [planId],
  );
  if (!plan) return null;

  const periods = await query(
    "SELECT * FROM strategic_periods WHERE plan_id = $1 ORDER BY sort_order",
    [planId],
  );
  const goals = await query(
    "SELECT * FROM strategic_goals WHERE plan_id = $1 ORDER BY sort_order",
    [planId],
  );
  const objectives = await query(
    `SELECT so.* FROM strategic_objectives so JOIN strategic_goals sg ON sg.id = so.goal_id WHERE sg.plan_id = $1 ORDER BY sg.sort_order, so.sort_order`,
    [planId],
  );
  const programs = await query(
    `SELECT spr.* FROM strategic_programs spr
     JOIN strategic_objectives so ON so.id = spr.objective_id
     JOIN strategic_goals sg ON sg.id = so.goal_id
     WHERE sg.plan_id = $1
     ORDER BY sg.sort_order, so.sort_order, spr.sort_order`,
    [planId],
  );
  const programIds = (programs as { id: string }[]).map(
    (program) => program.id,
  );
  const detail = programIds.length
    ? await query(
        `SELECT 'checklist' AS kind, pci.program_id, to_jsonb(pci.*) AS data FROM program_checklist_items pci WHERE pci.program_id = ANY($1::uuid[])
         UNION ALL
         SELECT 'targets' AS kind, ppt.program_id, to_jsonb(ppt.*) || jsonb_build_object('period_label', sp.label, 'period_year', sp.year) AS data FROM program_period_targets ppt JOIN strategic_periods sp ON sp.id = ppt.period_id WHERE ppt.program_id = ANY($1::uuid[])
         UNION ALL
         SELECT 'kpi_links' AS kind, pkl.program_id, to_jsonb(pkl.*) || jsonb_build_object('kpi_name', k.name, 'code', kd.code || '.' || ks.code || '.' || k.code) AS data FROM program_kpi_links pkl JOIN kpis k ON k.id = pkl.kpi_id JOIN kpi_standards ks ON ks.id = k.standard_id JOIN kpi_domains kd ON kd.id = ks.domain_id WHERE pkl.program_id = ANY($1::uuid[])
         UNION ALL
         SELECT 'collaborators' AS kind, pc.program_id, to_jsonb(pc.*) || jsonb_build_object('department_name', d.name) AS data FROM program_collaborators pc JOIN departments d ON d.id = pc.department_id WHERE pc.program_id = ANY($1::uuid[])
         UNION ALL
         SELECT 'budget' AS kind, pbl.program_id, to_jsonb(pbl.*) || jsonb_build_object('period_label', sp.label) AS data FROM program_budget_lines pbl JOIN strategic_periods sp ON sp.id = pbl.period_id WHERE pbl.program_id = ANY($1::uuid[])
         UNION ALL
         SELECT 'updates' AS kind, ppu.program_id, to_jsonb(ppu.*) || jsonb_build_object('author_name', p.full_name) AS data FROM program_progress_updates ppu LEFT JOIN profiles p ON p.user_id = ppu.author_id WHERE ppu.program_id = ANY($1::uuid[])`,
        [programIds],
      )
    : [];

  const detailMap = new Map<string, Record<string, unknown[]>>();
  for (const item of detail as {
    kind: string;
    program_id: string;
    data: unknown;
  }[]) {
    const bucket = detailMap.get(item.program_id) ?? {
      checklist: [],
      targets: [],
      kpi_links: [],
      collaborators: [],
      budget: [],
      updates: [],
    };
    bucket[item.kind] = [...(bucket[item.kind] ?? []), item.data];
    detailMap.set(item.program_id, bucket);
  }

  const programsByObjective = new Map<string, unknown[]>();
  for (const program of programs as { id: string; objective_id: string }[]) {
    const enriched = {
      ...program,
      ...(detailMap.get(program.id) ?? {
        checklist: [],
        targets: [],
        kpi_links: [],
        collaborators: [],
        budget: [],
        updates: [],
      }),
    };
    programsByObjective.set(program.objective_id, [
      ...(programsByObjective.get(program.objective_id) ?? []),
      enriched,
    ]);
  }

  const objectivesByGoal = new Map<string, unknown[]>();
  for (const objective of objectives as { id: string; goal_id: string }[]) {
    objectivesByGoal.set(objective.goal_id, [
      ...(objectivesByGoal.get(objective.goal_id) ?? []),
      { ...objective, programs: programsByObjective.get(objective.id) ?? [] },
    ]);
  }

  return {
    ...plan,
    periods,
    goals: (goals as { id: string }[]).map((goal) => ({
      ...goal,
      objectives: objectivesByGoal.get(goal.id) ?? [],
    })),
  };
}
