import { query } from "@/lib/db";
import {
  observationListQuerySchema,
  type ObservationListQuery,
} from "../schemas";
import type {
  ObservationActor,
  ObservationListItem,
  ObservationAcknowledgementMethod,
  ObservationListResponse,
  ObservationParticipantSummary,
  ObservationStatus,
  ObservationSummaryResponse,
} from "../types";
import {
  OBSERVATION_ATTENTION_LIMIT,
  OBSERVATION_RECENT_LIMIT,
  OBSERVATION_STALE_DAYS,
} from "../config";

interface ObservationListRow {
  id: string;
  title: string | null;
  status: ObservationStatus;
  participants: Array<{
    id: string;
    email: string;
    fullName: string | null;
    departmentId: string | null;
    departmentName: string | null;
    acknowledgedAt: Date | string | null;
    acknowledgementMethod: ObservationAcknowledgementMethod | null;
  }> | string;
  staff_id: string;
  staff_email: string;
  staff_name: string | null;
  manager_id: string | null;
  manager_email: string | null;
  manager_name: string | null;
  department_id: string | null;
  department_name: string | null;
  rubric_id: string;
  rubric_name: string;
  created_at: Date | string;
  updated_at: Date | string;
  observation_date: Date | string | null;
  due_at: Date | string | null;
  submitted_at: Date | string | null;
  acknowledged_at: Date | string | null;
  scope_type: "INDIVIDUAL" | "CLASS" | "SUBJECT";
  class_name: string | null;
  subject_name: string | null;
  acknowledged_count: number | string;
  participant_count: number | string;
  required_answered: number | string;
  required_total: number | string;
  optional_answered: number | string;
  optional_total: number | string;
  is_overdue: boolean;
  is_stale: boolean;
  action_required: boolean;
}

interface FilteredCountRow {
  total: number | string;
}

interface ObservationCountRow {
  draft: number | string;
  awaiting_acknowledgement: number | string;
  completed: number | string;
  action_required: number | string;
  overdue: number | string;
  stale: number | string;
  completed_this_month: number | string;
}



const statusExpression = `CASE
  WHEN o.status::text IN ('pending', 'draft') THEN 'draft'
  WHEN o.status::text IN ('reviewed', 'submitted', 'acknowledged')
    AND EXISTS (
      SELECT 1 FROM observation_participants status_participant
      WHERE status_participant.observation_id = o.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM observation_participants status_participant
      WHERE status_participant.observation_id = o.id
        AND status_participant.acknowledged_at IS NULL
    ) THEN 'acknowledged'
  WHEN o.status::text IN ('reviewed', 'submitted', 'acknowledged') THEN 'submitted'
  ELSE o.status::text
END`;

function toIso(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toNumber(value: number | string): number {
  return typeof value === "number" ? value : Number(value);
}

function parseParticipants(
  value: ObservationListRow["participants"],
): ObservationParticipantSummary[] {
  const participants: Exclude<ObservationListRow["participants"], string> =
    typeof value === "string"
      ? (JSON.parse(value) as Exclude<
          ObservationListRow["participants"],
          string
        >)
      : value;
  return participants.map((participant) => ({
    id: participant.id,
    email: participant.email,
    fullName: participant.fullName,
    department:
      participant.departmentId && participant.departmentName
        ? { id: participant.departmentId, name: participant.departmentName }
        : null,
    acknowledgedAt: toIso(participant.acknowledgedAt),
    acknowledgementMethod: participant.acknowledgementMethod,
  }));
}

function buildVisibilityClause(actor: ObservationActor, params: unknown[]): string {
  if (actor.roles.includes("admin") || actor.roles.includes("director")) return "TRUE";

  params.push(actor.id);
  const actorParam = `$${params.length}`;
  if (actor.roles.includes("manager")) {
    return `(o."managerId" = ${actorParam} OR (
      EXISTS (
        SELECT 1 FROM observation_participants visibility_participant
        WHERE visibility_participant.observation_id = o.id
          AND visibility_participant.staff_id = ${actorParam}
      )
      AND (${statusExpression}) <> 'draft'
    ))`;
  }
  return `(EXISTS (
    SELECT 1 FROM observation_participants visibility_participant
    WHERE visibility_participant.observation_id = o.id
      AND visibility_participant.staff_id = ${actorParam}
  ) AND (${statusExpression}) <> 'draft')`;
}

function actionExpressionNeedsActor(actor: ObservationActor): boolean {
  return (
    !actor.roles.includes("admin") &&
    (actor.roles.includes("manager") || !actor.roles.includes("director"))
  );
}

function buildActionRequiredExpression(
  actor: ObservationActor,
  actorParam: string | null,
): string {
  if (actor.roles.includes("admin")) {
    return `((${statusExpression}) <> 'acknowledged' AND o.due_at < NOW()) OR o."managerId" IS NULL`;
  }
  if (actor.roles.includes("manager")) {
    const managerActions = `(o."managerId" = ${actorParam} AND (${statusExpression}) = 'draft')
      OR (o."managerId" IS DISTINCT FROM ${actorParam}
        AND EXISTS (
          SELECT 1 FROM observation_participants action_participant
          WHERE action_participant.observation_id = o.id
            AND action_participant.staff_id = ${actorParam}
            AND action_participant.acknowledged_at IS NULL
        )
        AND (${statusExpression}) = 'submitted')`;
    if (actor.roles.includes("director")) {
      return `(${managerActions}) OR (
        o."managerId" IS DISTINCT FROM ${actorParam}
        AND NOT EXISTS (
          SELECT 1 FROM observation_participants action_participant
          WHERE action_participant.observation_id = o.id
            AND action_participant.staff_id = ${actorParam}
        )
        AND (${statusExpression}) <> 'acknowledged'
        AND o.due_at < NOW()
      )`;
    }
    return managerActions;
  }
  if (actor.roles.includes("director")) {
    return `((${statusExpression}) <> 'acknowledged' AND o.due_at < NOW())`;
  }
  return `(EXISTS (
    SELECT 1 FROM observation_participants action_participant
    WHERE action_participant.observation_id = o.id
      AND action_participant.staff_id = ${actorParam}
      AND action_participant.acknowledged_at IS NULL
  ) AND (${statusExpression}) = 'submitted')`;
}

export function buildListFilters(
  actor: ObservationActor,
  input: ObservationListQuery,
  params: unknown[],
): { whereSql: string; actionExpression: string } {
  const clauses = [buildVisibilityClause(actor, params)];
  let actorParam: string | null = params.length > 0 ? `$${params.length}` : null;
  if (actionExpressionNeedsActor(actor) && !actorParam) {
    params.push(actor.id);
    actorParam = `$${params.length}`;
  }
  const actionExpression = buildActionRequiredExpression(actor, actorParam);

  if (input.q) {
    params.push(`%${input.q}%`);
    const param = `$${params.length}`;
    clauses.push(`(
      COALESCE(o.title, '') ILIKE ${param}
      OR EXISTS (
        SELECT 1
        FROM observation_participants search_participant
        JOIN users search_user ON search_user.id = search_participant.staff_id
        LEFT JOIN profiles search_profile ON search_profile.user_id = search_user.id
        WHERE search_participant.observation_id = o.id
          AND (
            COALESCE(search_profile.full_name, '') ILIKE ${param}
            OR search_user.email ILIKE ${param}
          )
      )
      OR COALESCE(mp.full_name, '') ILIKE ${param}
      OR COALESCE(mu.email, '') ILIKE ${param}
      OR rt.name ILIKE ${param}
      OR EXISTS (
        SELECT 1
        FROM observation_participants search_department_participant
        JOIN profiles search_department_profile
          ON search_department_profile.user_id = search_department_participant.staff_id
        JOIN departments search_department
          ON search_department.id = search_department_profile.department_id
        WHERE search_department_participant.observation_id = o.id
          AND search_department.name ILIKE ${param}
      )
    )`);
  }
  if (input.status) {
    params.push(input.status);
    clauses.push(`(${statusExpression}) = $${params.length}`);
  }
  const participantId = input.participantId ?? input.staffId;
  if (participantId) {
    params.push(participantId);
    clauses.push(`EXISTS (
      SELECT 1 FROM observation_participants filtered_participant
      WHERE filtered_participant.observation_id = o.id
        AND filtered_participant.staff_id = $${params.length}
    )`);
  }
  if (input.managerId) {
    params.push(input.managerId === "me" ? actor.id : input.managerId);
    clauses.push(`o."managerId" = $${params.length}`);
  }
  if (input.departmentId) {
    params.push(input.departmentId);
    clauses.push(`EXISTS (
      SELECT 1
      FROM observation_participants department_participant
      JOIN profiles department_profile
        ON department_profile.user_id = department_participant.staff_id
      WHERE department_participant.observation_id = o.id
        AND department_profile.department_id = $${params.length}
    )`);
  }
  if (input.rubricId) {
    params.push(input.rubricId);
    clauses.push(`o.template_id = $${params.length}`);
  }
  if (input.actionRequired) {
    clauses.push(
      input.actionRequired === "true"
        ? `(${actionExpression})`
        : `NOT (${actionExpression})`,
    );
  }
  if (input.overdue) {
    const expression = `((${statusExpression}) <> 'acknowledged' AND o.due_at < NOW())`;
    clauses.push(input.overdue === "true" ? expression : `NOT ${expression}`);
  }
  if (input.from) {
    params.push(input.from);
    clauses.push(`o.observation_date >= $${params.length}::date`);
  }
  if (input.to) {
    params.push(input.to);
    clauses.push(`o.observation_date < ($${params.length}::date + INTERVAL '1 day')`);
  }

  return { whereSql: clauses.join(" AND "), actionExpression };
}

function sortSql(sort: ObservationListQuery["sort"], alias = "o"): string {
  switch (sort) {
    case "updated_asc":
      return `${alias}.updated_at ASC`;
    case "created_desc":
      return `${alias}.created_at DESC`;
    case "created_asc":
      return `${alias}.created_at ASC`;
    case "due_asc":
      return `${alias}.due_at ASC NULLS LAST`;
    case "due_desc":
      return `${alias}.due_at DESC NULLS LAST`;
    default:
      return `${alias}.updated_at DESC`;
  }
}

function mapListItem(actor: ObservationActor, row: ObservationListRow): ObservationListItem {
  const participants = parseParticipants(row.participants);
  const firstParticipant = participants[0];
  if (!firstParticipant) {
    throw new Error(`Observation ${row.id} has no participants.`);
  }
  const requiredAnswered = toNumber(row.required_answered);
  const requiredTotal = toNumber(row.required_total);
  const optionalAnswered = toNumber(row.optional_answered);
  const optionalTotal = toNumber(row.optional_total);
  const canSeeDraftProgress =
    actor.roles.includes("admin") || row.manager_id === actor.id;
  const progress =
    row.status === "draft" && !canSeeDraftProgress
      ? null
      : {
          requiredAnswered,
          requiredTotal,
          optionalAnswered,
          optionalTotal,
          percentage:
            requiredTotal === 0
              ? 100
              : Math.round((requiredAnswered / requiredTotal) * 100),
        };

  let nextAction: ObservationListItem["nextAction"] = "view";
  if (row.manager_id === actor.id && row.status === "draft") nextAction = "continue";
  else if (
    participants.some(
      (participant) =>
        participant.id === actor.id && participant.acknowledgedAt === null,
    ) && row.status === "submitted"
  ) nextAction = "acknowledge";
  else if (row.action_required) nextAction = "follow_up";

  return {
    id: row.id,
    title: row.title,
    status: row.status,
    participants,
    staff: {
      id: firstParticipant.id,
      email: firstParticipant.email,
      fullName: firstParticipant.fullName,
    },
    manager: row.manager_id && row.manager_email
      ? { id: row.manager_id, email: row.manager_email, fullName: row.manager_name }
      : null,
    department: row.department_id && row.department_name
      ? { id: row.department_id, name: row.department_name }
      : null,
    rubric: { id: row.rubric_id, name: row.rubric_name },
    createdAt: toIso(row.created_at)!,
    updatedAt: toIso(row.updated_at)!,
    observationDate: toIso(row.observation_date),
    dueAt: toIso(row.due_at),
    submittedAt: toIso(row.submitted_at),
    acknowledgedAt: toIso(row.acknowledged_at),
    scope: {
      type: row.scope_type,
      className: row.class_name,
      subjectName: row.subject_name,
    },
    acknowledgementProgress: {
      acknowledged: toNumber(row.acknowledged_count),
      total: toNumber(row.participant_count),
      pending: toNumber(row.participant_count) - toNumber(row.acknowledged_count),
      percentage:
        toNumber(row.participant_count) === 0
          ? 0
          : Math.round(
              (toNumber(row.acknowledged_count) /
                toNumber(row.participant_count)) *
                100,
            ),
    },
    progress,
    isOverdue: row.is_overdue,
    isStale: row.is_stale,
    nextAction,
  };
}

export async function queryObservationList(
  actor: ObservationActor,
  input: ObservationListQuery,
): Promise<ObservationListResponse> {
  const params: unknown[] = [];
  const { whereSql, actionExpression } = buildListFilters(actor, input, params);
  params.push(input.pageSize, (input.page - 1) * input.pageSize);
  const limitParam = `$${params.length - 1}`;
  const offsetParam = `$${params.length}`;

  const rows = await query<ObservationListRow>(
    `WITH paged_observations AS (
       SELECT
         o.id,
         o.title,
         (${statusExpression})::text AS status,
         participant_data.participants,
         participant_data.staff_id,
         participant_data.staff_email,
         participant_data.staff_name,
         participant_data.department_id,
         participant_data.department_name,
         participant_data.staff_acknowledged_at AS acknowledged_at,
         participant_data.acknowledged_count,
         participant_data.participant_count,
         o."managerId" AS manager_id,
         mu.email AS manager_email,
         mp.full_name AS manager_name,
         rt.id AS rubric_id,
         rt.name AS rubric_name,
         o.created_at,
         o.updated_at,
         o.observation_date,
         o.due_at,
         o.submitted_at,
         COALESCE(o.scope_type, 'INDIVIDUAL')::text AS scope_type,
         o.class_name,
         o.subject_name,
         ((${statusExpression}) <> 'acknowledged' AND o.due_at < NOW()) AS is_overdue,
         (((${statusExpression}) = 'draft' AND o.updated_at < NOW() - INTERVAL '${OBSERVATION_STALE_DAYS} days')
           OR ((${statusExpression}) = 'submitted' AND o.submitted_at < NOW() - INTERVAL '${OBSERVATION_STALE_DAYS} days')) AS is_stale,
         (${actionExpression}) AS action_required
       FROM observations o
       JOIN LATERAL (
         SELECT
           JSONB_AGG(
             JSONB_BUILD_OBJECT(
               'id', ordered.staff_id,
               'email', ordered.email,
               'fullName', ordered.full_name,
               'departmentId', ordered.department_id,
               'departmentName', ordered.department_name,
               'acknowledgedAt', ordered.acknowledged_at,
               'acknowledgementMethod', ordered.acknowledgement_method
             ) ORDER BY ordered.sort_name, ordered.email, ordered.staff_id
           ) AS participants,
           (ARRAY_AGG(ordered.staff_id ORDER BY ordered.sort_name, ordered.email, ordered.staff_id))[1] AS staff_id,
           (ARRAY_AGG(ordered.email ORDER BY ordered.sort_name, ordered.email, ordered.staff_id))[1] AS staff_email,
           (ARRAY_AGG(ordered.full_name ORDER BY ordered.sort_name, ordered.email, ordered.staff_id))[1] AS staff_name,
           (ARRAY_AGG(ordered.department_id ORDER BY ordered.sort_name, ordered.email, ordered.staff_id))[1] AS department_id,
           (ARRAY_AGG(ordered.department_name ORDER BY ordered.sort_name, ordered.email, ordered.staff_id))[1] AS department_name,
           (ARRAY_AGG(ordered.acknowledged_at ORDER BY ordered.sort_name, ordered.email, ordered.staff_id))[1] AS staff_acknowledged_at,
           COUNT(*) FILTER (WHERE ordered.acknowledged_at IS NOT NULL) AS acknowledged_count,
           COUNT(*) AS participant_count
         FROM (
           SELECT
             op.staff_id,
             pu.email,
             pp.full_name,
             pp.department_id,
             pd.name AS department_name,
             op.acknowledged_at,
             op.acknowledgement_method,
             COALESCE(NULLIF(BTRIM(pp.full_name), ''), pu.email) AS sort_name
           FROM observation_participants op
           JOIN users pu ON pu.id = op.staff_id
           LEFT JOIN profiles pp ON pp.user_id = pu.id
           LEFT JOIN departments pd ON pd.id = pp.department_id
           WHERE op.observation_id = o.id
         ) ordered
       ) participant_data ON participant_data.participant_count > 0
       LEFT JOIN users mu ON mu.id = o."managerId"
       LEFT JOIN profiles mp ON mp.user_id = mu.id
       JOIN rubric_templates rt ON rt.id = o.template_id
       WHERE ${whereSql}
       ORDER BY ${sortSql(input.sort)}
       LIMIT ${limitParam} OFFSET ${offsetParam}
     )
     SELECT p.*, progress.*
     FROM paged_observations p
     CROSS JOIN LATERAL (
       SELECT
         COUNT(ri.id) FILTER (WHERE ri.is_required) AS required_total,
         COUNT(ri.id) FILTER (
           WHERE ri.is_required AND (
             (COALESCE(ri.question_type::text, 'SCALE') = 'SCALE' AND oa.score BETWEEN 1 AND 4)
             OR (ri.question_type::text = 'TEXT' AND NULLIF(BTRIM(oa.text_value), '') IS NOT NULL)
             OR (ri.question_type::text = 'CHOICE'
               AND NULLIF(BTRIM(oa.selected_option), '') IS NOT NULL
               AND (
                 ri.score_options IS NULL
                 OR jsonb_array_length(ri.score_options) = 0
                 OR ri.score_options ? oa.selected_option
               ))
           )
         ) AS required_answered,
         COUNT(ri.id) FILTER (WHERE NOT ri.is_required) AS optional_total,
         COUNT(ri.id) FILTER (
           WHERE NOT ri.is_required AND (
             (COALESCE(ri.question_type::text, 'SCALE') = 'SCALE' AND oa.score BETWEEN 1 AND 4)
             OR (ri.question_type::text = 'TEXT' AND NULLIF(BTRIM(oa.text_value), '') IS NOT NULL)
             OR (ri.question_type::text = 'CHOICE'
               AND NULLIF(BTRIM(oa.selected_option), '') IS NOT NULL
               AND (
                 ri.score_options IS NULL
                 OR jsonb_array_length(ri.score_options) = 0
                 OR ri.score_options ? oa.selected_option
               ))
           )
         ) AS optional_answered
       FROM rubric_sections rs
       JOIN rubric_indicators ri ON ri.section_id = rs.id
       LEFT JOIN observation_answers oa
         ON oa.observation_id = p.id AND oa.indicator_id = ri.id
       WHERE rs.template_id = p.rubric_id
     ) progress
     ORDER BY ${sortSql(input.sort, "p")}`,
    params,
  );

  const countParams: unknown[] = [];
  const { whereSql: countWhereSql } = buildListFilters(
    actor,
    input,
    countParams,
  );
  const summaryParams: unknown[] = [];
  const visibility = buildVisibilityClause(actor, summaryParams);
  let summaryActorParam: string | null =
    summaryParams.length > 0 ? `$${summaryParams.length}` : null;
  if (actionExpressionNeedsActor(actor) && !summaryActorParam) {
    summaryParams.push(actor.id);
    summaryActorParam = `$${summaryParams.length}`;
  }
  const summaryActionExpression = buildActionRequiredExpression(
    actor,
    summaryActorParam,
  );
  const [filteredCounts, summaryCounts] = await Promise.all([
    query<FilteredCountRow>(
      `SELECT COUNT(*) AS total
       FROM observations o
       LEFT JOIN users mu ON mu.id = o."managerId"
       LEFT JOIN profiles mp ON mp.user_id = mu.id
       JOIN rubric_templates rt ON rt.id = o.template_id
       WHERE ${countWhereSql}`,
      countParams,
    ),
    query<ObservationCountRow>(
      `SELECT
       COUNT(*) FILTER (WHERE (${statusExpression}) = 'draft') AS draft,
       COUNT(*) FILTER (WHERE (${statusExpression}) = 'submitted') AS awaiting_acknowledgement,
       COUNT(*) FILTER (WHERE (${statusExpression}) = 'acknowledged') AS completed,
       COUNT(*) FILTER (WHERE ${summaryActionExpression}) AS action_required,
       COUNT(*) FILTER (WHERE (${statusExpression}) <> 'acknowledged' AND o.due_at < NOW()) AS overdue,
       COUNT(*) FILTER (WHERE
         ((${statusExpression}) = 'draft' AND o.updated_at < NOW() - INTERVAL '${OBSERVATION_STALE_DAYS} days')
         OR ((${statusExpression}) = 'submitted' AND o.submitted_at < NOW() - INTERVAL '${OBSERVATION_STALE_DAYS} days')
       ) AS stale,
       COUNT(*) FILTER (WHERE (${statusExpression}) = 'acknowledged'
         AND (
           SELECT MAX(completed_participant.acknowledged_at)
           FROM observation_participants completed_participant
           WHERE completed_participant.observation_id = o.id
         ) >= DATE_TRUNC('month', NOW())) AS completed_this_month
       FROM observations o
       WHERE ${visibility}`,
      summaryParams,
    ),
  ]);
  const counts = summaryCounts[0];
  const total = filteredCounts[0] ? toNumber(filteredCounts[0].total) : 0;
  return {
    data: rows.map((row) => mapListItem(actor, row)),
    pagination: {
      page: input.page,
      pageSize: input.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / input.pageSize),
    },
    summary: {
      draft: counts ? toNumber(counts.draft) : 0,
      awaitingAcknowledgement: counts ? toNumber(counts.awaiting_acknowledgement) : 0,
      completed: counts ? toNumber(counts.completed) : 0,
      actionRequired: counts ? toNumber(counts.action_required) : 0,
      overdue: counts ? toNumber(counts.overdue) : 0,
      stale: counts ? toNumber(counts.stale) : 0,
      completedThisMonth: counts ? toNumber(counts.completed_this_month) : 0,
    },
  };
}

export async function queryObservationSummary(
  actor: ObservationActor,
): Promise<ObservationSummaryResponse> {
  const base = observationListQuerySchema.parse({ page: 1, pageSize: 10 });
  const [summaryResult, needsAttentionResult, recentResult] = await Promise.all([
    queryObservationList(actor, base),
    queryObservationList(actor, {
      ...base,
      actionRequired: "true",
      sort: "due_asc",
    }),
    queryObservationList(actor, {
      ...base,
      sort: "updated_desc",
    }),
  ]);

  return {
    counts: summaryResult.summary,
    needsAttention: needsAttentionResult.data.slice(0, OBSERVATION_ATTENTION_LIMIT),
    recent: recentResult.data.slice(0, OBSERVATION_RECENT_LIMIT),
    pipeline: [
      { status: "draft", count: summaryResult.summary.draft },
      {
        status: "submitted",
        count: summaryResult.summary.awaitingAcknowledgement,
      },
      { status: "acknowledged", count: summaryResult.summary.completed },
    ],
  };
}
