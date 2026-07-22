import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getObservationSession } from "@/features/observations/server/auth";
import { pool, queryOne } from "@/lib/db";
import { notifyObservationAssigned } from "@/lib/notifications/observation-notifications";
import { parseObservationListQuery } from "@/features/observations/schemas";
import { queryObservationList } from "@/features/observations/server/queries";
import type { CreateObservationInput, CreateObservationResponse } from "@/features/observations/types";

interface PersonRow {
  id: string;
  email: string;
  fullName: string | null;
  departmentId?: string | null;
  hasStaffRole?: boolean;
  hasManagerRole?: boolean;
}

interface RubricAssignmentRow {
  id: string;
  name: string;
  workflowId: string;
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
    const body = (await req.json().catch(() => ({}))) as Partial<CreateObservationInput>;
    const staffId = body.staffId?.trim();
    const rubricId = body.rubricId?.trim();
    const workflowId = body.workflowId?.trim() || null;
    const managerId = isAdmin ? body.managerId?.trim() || user.id : user.id;
    if (!staffId || !rubricId) {
      return NextResponse.json(
        { error: "staffId and rubricId are required." },
        { status: 400 },
      );
    }

    const title = optionalText(body.title, 200);
    const description = optionalText(body.description, 2000);
    const observationDate = parseDate(body.observationDate, "Observation date");
    const dueAt = parseDate(body.dueAt, "Due date", true)!;
    if (dueAt < startOfToday()) {
      return NextResponse.json(
        { error: "Due date cannot be in the past." },
        { status: 400 },
      );
    }
    if (observationDate && dueAt < observationDate) {
      return NextResponse.json(
        { error: "Due date cannot precede the observation date." },
        { status: 400 },
      );
    }

    const staff = await queryOne<PersonRow>(
      `SELECT
         u.id, u.email, p.full_name AS "fullName",
         p.department_id AS "departmentId",
         bool_or(ur.role = 'staff') AS "hasStaffRole"
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       WHERE u.id = $1 AND u.status = 'active'
       GROUP BY u.id, u.email, p.full_name, p.department_id`,
      [staffId],
    );
    if (!staff) {
      return NextResponse.json({ error: "Staff member not found." }, { status: 404 });
    }
    if (!staff.hasStaffRole) {
      return NextResponse.json(
        { error: "Selected user must be active and have the staff role." },
        { status: 400 },
      );
    }
    if (!isAdmin && staffId === user.id) {
      return NextResponse.json(
        { error: "Managers cannot create observations for themselves." },
        { status: 400 },
      );
    }
    if (!isAdmin) {
      const sameDepartment = await queryOne(
        `SELECT 1 FROM profiles WHERE user_id = $1 AND department_id = $2`,
        [user.id, staff.departmentId],
      );
      if (!sameDepartment) {
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
      [managerId],
    );
    if (!manager || !manager.hasManagerRole) {
      return NextResponse.json(
        { error: "Assigned manager must be an active manager or administrator." },
        { status: 400 },
      );
    }
    if (staffId === managerId) {
      return NextResponse.json(
        { error: "The assigned manager cannot be the observation subject." },
        { status: 400 },
      );
    }

    const assignment = await queryOne<RubricAssignmentRow>(
      `SELECT rt.id, rt.name, rwa.workflow_id AS "workflowId"
       FROM rubric_templates rt
       JOIN role_workflow_assignments rwa ON rwa.rubric_id = rt.id
       JOIN workflow_definitions wd ON wd.id = rwa.workflow_id
       JOIN department_roles dr ON dr.id = rwa.department_role_id
       JOIN profiles sp ON sp.user_id = $1
       JOIN user_roles sur ON sur.user_id = $1 AND sur.role = dr.role
       WHERE rt.id = $2
         AND rt.is_active = true
         AND rt.template_type IN ('CLASSROOM_OBSERVATION', 'GENERIC')
         AND rwa.is_active = true
         AND wd.type = 'CLASSROOM_OBSERVATION'
         AND (dr.department_id = sp.department_id OR dr.department_id IS NULL)
         AND ($3::text IS NULL OR rwa.workflow_id::text = $3::text)
       ORDER BY rwa.workflow_id
       LIMIT 1`,
      [staffId, rubricId, workflowId],
    );
    if (!assignment) {
      return NextResponse.json(
        { error: "This observation form is not assigned to the selected staff member's active role." },
        { status: 403 },
      );
    }

    const observationId = randomUUID();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO observations
           (id, "staffId", "managerId", template_id, status, title, description,
            observation_date, due_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'draft', $5, $6, $7, $8, NOW(), NOW())`,
        [
          observationId,
          staffId,
          managerId,
          rubricId,
          title,
          description,
          observationDate,
          dueAt,
        ],
      );
      await client.query(
        `INSERT INTO observation_updates
           (id, observation_id, updated_by_id, status_from, status_to, event_type, notes, created_at)
         VALUES ($1, $2, $3, NULL, 'draft', 'created', $4, NOW())`,
        [randomUUID(), observationId, user.id, "Observation draft created"],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    if (managerId !== user.id) {
      await notifyObservationAssigned(
        manager.email,
        manager.fullName ?? manager.email,
        staff.fullName ?? staff.email,
        assignment.name,
        observationId,
      ).catch((error: unknown) =>
        console.error("Observation assignment notification error:", error),
      );
    }

    const response: CreateObservationResponse = {
      observation: {
        id: observationId,
        status: "draft",
        title,
        description,
        observationDate: observationDate?.toISOString() ?? null,
        dueAt: dueAt.toISOString(),
        staff: { id: staff.id, email: staff.email, fullName: staff.fullName },
        manager: { id: manager.id, email: manager.email, fullName: manager.fullName },
        rubric: { id: assignment.id, name: assignment.name },
      },
    };
    return NextResponse.json(response, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("POST /api/observations error:", error);
    const status = message.includes("characters or fewer") || message.includes("is invalid") || message.includes("is required") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
