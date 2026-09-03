import { NextResponse } from "next/server";
import { getObservationSession } from "@/features/observations/server/auth";
import { query, queryOne } from "@/lib/db";
import { managerStaffScopeExistsSql } from "@/lib/organization-access";
import type { ObservationCreationForm } from "@/features/observations/types";

interface StaffAccessRow {
  id: string;
  isActive: boolean;
  hasStaffRole: boolean;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseStaffIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) {
    throw new Error("staffIds must contain between 1 and 20 staff IDs.");
  }
  const staffIds = value.map((staffId) => {
    if (typeof staffId !== "string" || !UUID_PATTERN.test(staffId.trim())) {
      throw new Error("Every staff ID must be a valid UUID.");
    }
    return staffId.trim().toLowerCase();
  });
  if (new Set(staffIds).size !== staffIds.length) {
    throw new Error("Duplicate staff IDs are not allowed.");
  }
  return staffIds;
}

async function availableForms(value: unknown) {
  const session = await getObservationSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRoles = (session.user as { roles?: string[] }).roles ?? [];
  const isAdmin = userRoles.includes("admin");
  const isManager = userRoles.includes("manager");
  if (!isAdmin && !isManager) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const staffIds = parseStaffIds(value);
  if (staffIds.includes(session.user.id.toLowerCase())) {
    return NextResponse.json(
      { error: "You cannot create an observation for yourself." },
      { status: 400 },
    );
  }

  const staff = await query<StaffAccessRow>(
    `SELECT
       u.id,
       u.status = 'active' AS "isActive",
       EXISTS (
         SELECT 1
           FROM department_role_memberships drm
           JOIN department_roles dr ON dr.id = drm.department_role_id
          WHERE drm.user_id = u.id AND dr.role::text = 'staff' AND dr.department_id IS NOT NULL
       ) AS "hasStaffRole"
     FROM users u
     WHERE u.id = ANY($1::uuid[])
     GROUP BY u.id, u.status`,
    [staffIds],
  );
  if (
    staff.length !== staffIds.length ||
    staff.some((person) => !person.isActive || !person.hasStaffRole)
  ) {
    return NextResponse.json(
      { error: "Every selected participant must be an active staff member." },
      { status: 400 },
    );
  }

  if (!isAdmin) {
    const outOfScope = await queryOne<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM UNNEST($1::uuid[]) AS selected(staff_id)
       WHERE NOT ${managerStaffScopeExistsSql("selected.staff_id", "$2")}`,
      [staffIds, session.user.id],
    );
    if (!outOfScope || outOfScope.count > 0) {
      return NextResponse.json(
        { error: "Managers can only view forms for staff in their department." },
        { status: 403 },
      );
    }
  }

  const forms = await query<ObservationCreationForm>(
    `WITH selected_staff AS (
       SELECT UNNEST($1::uuid[]) AS staff_id
     ), eligible_assignments AS (
       SELECT DISTINCT selected.staff_id, rt.id AS rubric_id, wd.id AS workflow_id
       FROM selected_staff selected
       JOIN department_role_memberships drm ON drm.user_id = selected.staff_id
       JOIN department_roles dr
         ON dr.id = drm.department_role_id
        AND dr.role::text = 'staff'
        AND dr.department_id IS NOT NULL
       JOIN role_workflow_assignments rwa
         ON rwa.department_role_id = dr.id AND rwa.is_active = true
       JOIN rubric_templates rt
         ON rt.id = rwa.rubric_id
        AND rt.is_active = true
        AND rt.template_type IN ('CLASSROOM_OBSERVATION', 'GENERIC')
       JOIN workflow_definitions wd
         ON wd.id = rwa.workflow_id AND wd.type = 'CLASSROOM_OBSERVATION'
     )
     SELECT
       rt.id,
       rt.name,
       rt.description,
       rt.template_type AS "templateType",
       wd.id AS "workflowId",
       wd.name AS "workflowName",
       COUNT(DISTINCT rs.id)::int AS "sectionCount",
       COUNT(DISTINCT ri.id)::int AS "indicatorCount"
     FROM eligible_assignments eligible
     JOIN rubric_templates rt ON rt.id = eligible.rubric_id
     JOIN workflow_definitions wd ON wd.id = eligible.workflow_id
     LEFT JOIN rubric_sections rs ON rs.template_id = rt.id
     LEFT JOIN rubric_indicators ri ON ri.section_id = rs.id
     GROUP BY rt.id, rt.name, rt.description, rt.template_type, wd.id, wd.name
     HAVING COUNT(DISTINCT eligible.staff_id) = CARDINALITY($1::uuid[])
     ORDER BY rt.name ASC, wd.name ASC`,
    [staffIds],
  );

  return NextResponse.json(forms);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { staffIds?: unknown };
    return await availableForms(body.staffIds);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("POST /api/observations/available-forms error:", error);
    const status = message.includes("staff ID") || message.includes("staffIds") || message.includes("Duplicate") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function GET(request: Request) {
  try {
    const staffId = new URL(request.url).searchParams.get("staffId")?.trim();
    return await availableForms(staffId ? [staffId] : null);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("GET /api/observations/available-forms error:", error);
    const status = message.includes("staff ID") || message.includes("staffIds") || message.includes("Duplicate") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
