import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getObservationSession } from "@/features/observations/server/auth";
import { pool, query, queryOne } from "@/lib/db";

import { parseObservationListQuery } from "@/features/observations/schemas";
import { queryObservationList } from "@/features/observations/server/queries";
import type { CreateObservationResponse } from "@/features/observations/types";

interface PersonRow {
  id: string;
  email: string;
  fullName: string | null;
  departmentId?: string | null;
  isActive?: boolean;
  hasStaffRole?: boolean;
  hasManagerRole?: boolean;
}

interface RubricAssignmentRow {
  id: string;
  name: string;
  workflowId: string;
}

type ObservationScopeType = "INDIVIDUAL" | "CLASS" | "SUBJECT";

interface CreateObservationRequest {
  staffId?: unknown;
  staffIds?: unknown;
  rubricId?: unknown;
  workflowId?: unknown;
  title?: unknown;
  description?: unknown;
  observationDate?: unknown;
  dueAt?: unknown;
  scopeType?: unknown;
  className?: unknown;
  subjectName?: unknown;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isRequestObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function optionalText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLength) {
    throw new Error(`Text must be ${maxLength} characters or fewer.`);
  }
  return trimmed;
}

function parseDate(value: unknown, field: string, required = false): Date | null {
  if (typeof value !== "string" || !value.trim()) {
    if (required) throw new Error(`${field} is required.`);
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${field} is invalid.`);
  return date;
}

function parseStaffIds(body: CreateObservationRequest): string[] {
  const hasStaffId = Object.prototype.hasOwnProperty.call(body, "staffId");
  const hasStaffIds = Object.prototype.hasOwnProperty.call(body, "staffIds");
  if (hasStaffId && hasStaffIds) {
    throw new Error("Send staffIds or the legacy staffId, not both.");
  }

  const values = hasStaffIds ? body.staffIds : hasStaffId ? [body.staffId] : null;
  if (!Array.isArray(values) || values.length < 1 || values.length > 20) {
    throw new Error("staffIds must contain between 1 and 20 staff IDs.");
  }

  const staffIds = values.map((value) => {
    if (typeof value !== "string" || !UUID_PATTERN.test(value.trim())) {
      throw new Error("Every staff ID must be a valid UUID.");
    }
    return value.trim().toLowerCase();
  });
  if (new Set(staffIds).size !== staffIds.length) {
    throw new Error("Duplicate staff IDs are not allowed.");
  }
  return staffIds;
}

function parseScope(
  body: CreateObservationRequest,
  participantCount: number,
): { scopeType: ObservationScopeType; className: string | null; subjectName: string | null } {
  const rawScope = typeof body.scopeType === "string" ? body.scopeType.trim().toUpperCase() : "INDIVIDUAL";
  if (!(["INDIVIDUAL", "CLASS", "SUBJECT"] as string[]).includes(rawScope)) {
    throw new Error("scopeType must be INDIVIDUAL, CLASS, or SUBJECT.");
  }

  const scopeType = rawScope as ObservationScopeType;
  const className = optionalText(body.className, 200);
  const subjectName = optionalText(body.subjectName, 200);
  if (participantCount > 1 && scopeType === "INDIVIDUAL") {
    throw new Error("Multi-teacher observations must use CLASS or SUBJECT scope.");
  }
  if (scopeType === "CLASS" && !className) throw new Error("Class name is required for class scope.");
  if (scopeType === "SUBJECT" && !subjectName) throw new Error("Subject name is required for subject scope.");
  return { scopeType, className, subjectName };
}

function startOfToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

export async function GET(req: Request) {
  const session = await getObservationSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = {
    id: session.user.id,
    roles: (session.user as { roles?: string[] }).roles ?? [],
  };
  try {
    const input = parseObservationListQuery(new URL(req.url).searchParams);
    return NextResponse.json(await queryObservationList(user, input));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("GET /api/observations error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getObservationSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = {
    id: session.user.id,
    roles: (session.user as { roles?: string[] }).roles ?? [],
  };
  const isAdmin = user.roles.includes("admin");
  const isManager = user.roles.includes("manager");
  if (!isAdmin && !isManager) {
    return NextResponse.json(
      { error: "Only managers and administrators can create observations." },
      { status: 403 },
    );
  }

  try {
    const parsedBody: unknown = await req.json().catch(() => ({}));
    if (!isRequestObject(parsedBody)) {
      return NextResponse.json(
        { error: "Request body must be a JSON object." },
        { status: 400 },
      );
    }
    const body = parsedBody as CreateObservationRequest;
    const staffIds = parseStaffIds(body);
    const rubricId = typeof body.rubricId === "string" ? body.rubricId.trim() : "";
    const workflowId = typeof body.workflowId === "string" ? body.workflowId.trim() || null : null;
    if (!UUID_PATTERN.test(rubricId)) {
      return NextResponse.json({ error: "rubricId must be a valid UUID." }, { status: 400 });
    }
    if (workflowId && !UUID_PATTERN.test(workflowId)) {
      return NextResponse.json({ error: "workflowId must be a valid UUID." }, { status: 400 });
    }

    const title = optionalText(body.title, 200);
    const description = optionalText(body.description, 2000);
    const observationDate = parseDate(body.observationDate, "Observation date");
    const dueAt = parseDate(body.dueAt, "Due date", true)!;
    const scope = parseScope(body, staffIds.length);
    if (dueAt < startOfToday()) {
      return NextResponse.json({ error: "Due date cannot be in the past." }, { status: 400 });
    }
    if (observationDate && dueAt < observationDate) {
      return NextResponse.json(
        { error: "Due date cannot precede the observation date." },
        { status: 400 },
      );
    }

    const participants = await query<PersonRow>(
      `SELECT
         u.id, u.email, p.full_name AS "fullName", p.department_id AS "departmentId",
         u.status = 'active' AS "isActive",
         bool_or(ur.role = 'staff') AS "hasStaffRole"
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       WHERE u.id = ANY($1::uuid[])
       GROUP BY u.id, u.email, u.status, p.full_name, p.department_id
       ORDER BY LOWER(COALESCE(NULLIF(p.full_name, ''), u.email)), LOWER(u.email), u.id`,
      [staffIds],
    );
    if (participants.length !== staffIds.length || participants.some((person) => !person.isActive)) {
      return NextResponse.json(
        { error: "Every selected staff member must exist and be active." },
        { status: 400 },
      );
    }
    if (participants.some((person) => !person.hasStaffRole)) {
      return NextResponse.json(
        { error: "Every selected user must have the staff role." },
        { status: 400 },
      );
    }
    if (staffIds.includes(user.id.toLowerCase())) {
      return NextResponse.json(
        { error: "You cannot create an observation for yourself." },
        { status: 400 },
      );
    }

    if (!isAdmin) {
      const outOfScope = await queryOne<{ count: number }>(
        `SELECT COUNT(*)::int AS count
         FROM UNNEST($1::uuid[]) AS selected(staff_id)
         LEFT JOIN profiles staff_profile ON staff_profile.user_id = selected.staff_id
         WHERE staff_profile.department_id IS NULL
            OR staff_profile.department_id IS DISTINCT FROM (
              SELECT manager_profile.department_id FROM profiles manager_profile WHERE manager_profile.user_id = $2
            )`,
        [staffIds, user.id],
      );
      if (!outOfScope || outOfScope.count > 0) {
        return NextResponse.json(
          { error: "Managers can only create observations for staff in their department." },
          { status: 403 },
        );
      }
    }

    const manager = await queryOne<PersonRow>(
      `SELECT
         u.id, u.email, p.full_name AS "fullName",
         bool_or(ur.role IN ('manager', 'admin')) AS "hasManagerRole"
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       WHERE u.id = $1 AND u.status = 'active'
       GROUP BY u.id, u.email, p.full_name`,
      [user.id],
    );
    if (!manager || !manager.hasManagerRole) {
      return NextResponse.json(
        { error: "The observer must be an active manager or administrator." },
        { status: 400 },
      );
    }

    const assignment = await queryOne<RubricAssignmentRow>(
      `WITH selected_staff AS (
         SELECT UNNEST($1::uuid[]) AS staff_id
       )
       SELECT rt.id, rt.name, rwa.workflow_id AS "workflowId"
       FROM selected_staff selected
       JOIN profiles sp ON sp.user_id = selected.staff_id
       JOIN user_roles sur ON sur.user_id = selected.staff_id
       JOIN department_roles dr
         ON dr.role = sur.role
        AND (dr.department_id = sp.department_id OR dr.department_id IS NULL)
       JOIN role_workflow_assignments rwa
         ON rwa.department_role_id = dr.id AND rwa.is_active = true
       JOIN rubric_templates rt
         ON rt.id = rwa.rubric_id
        AND rt.is_active = true
        AND rt.template_type IN ('CLASSROOM_OBSERVATION', 'GENERIC')
       JOIN workflow_definitions wd
         ON wd.id = rwa.workflow_id AND wd.type = 'CLASSROOM_OBSERVATION'
       WHERE rt.id = $2
         AND ($3::uuid IS NULL OR rwa.workflow_id = $3::uuid)
       GROUP BY rt.id, rt.name, rwa.workflow_id
       HAVING COUNT(DISTINCT selected.staff_id) = CARDINALITY($1::uuid[])
       ORDER BY rwa.workflow_id
       LIMIT 1`,
      [staffIds, rubricId, workflowId],
    );
    if (!assignment) {
      return NextResponse.json(
        { error: "This observation form and workflow are not assigned to every selected staff member's active role." },
        { status: 403 },
      );
    }

    const observationId = randomUUID();
    const legacyStaffId = participants[0].id;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO observations
           (id, "staffId", "managerId", template_id, status, title, description,
            observation_date, due_at, scope_type, class_name, subject_name, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'draft', $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())`,
        [
          observationId,
          legacyStaffId,
          user.id,
          rubricId,
          title,
          description,
          observationDate,
          dueAt,
          scope.scopeType,
          scope.className,
          scope.subjectName,
        ],
      );
      await client.query(
        `INSERT INTO observation_participants
           (id, observation_id, staff_id, created_at, updated_at)
         SELECT gen_random_uuid(), $1, selected.staff_id, NOW(), NOW()
         FROM UNNEST($2::uuid[]) AS selected(staff_id)`,
        [observationId, participants.map((participant) => participant.id)],
      );
      await client.query(
        `INSERT INTO observation_updates
           (id, observation_id, updated_by_id, status_from, status_to, event_type, notes, created_at)
         VALUES ($1, $2, $3, NULL, 'draft', 'created', $4, NOW())`,
        [
          randomUUID(),
          observationId,
          user.id,
          `Observation draft created for ${participants.length} participant${participants.length === 1 ? "" : "s"}`,
        ],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    const response = {
      observation: {
        id: observationId,
        status: "draft",
        title,
        description,
        observationDate: observationDate?.toISOString() ?? null,
        dueAt: dueAt.toISOString(),
        scopeType: scope.scopeType,
        className: scope.className,
        subjectName: scope.subjectName,
        participants: participants.map(({ id, email, fullName }) => ({ id, email, fullName })),
        staff: { id: participants[0].id, email: participants[0].email, fullName: participants[0].fullName },
        manager: { id: manager.id, email: manager.email, fullName: manager.fullName },
        rubric: { id: assignment.id, name: assignment.name },
      },
    } as CreateObservationResponse;
    return NextResponse.json(response, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("POST /api/observations error:", error);
    const status =
      message.includes("characters or fewer") ||
      message.includes("is invalid") ||
      message.includes("is required") ||
      message.includes("staffId") ||
      message.includes("staff ID") ||
      message.includes("scope") ||
      message.includes("Duplicate")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
