import { NextResponse } from "next/server";
import { getObservationSession } from "@/features/observations/server/auth";
import { query, queryOne } from "@/lib/db";
import type { ObservationCreationForm } from "@/features/observations/types";

interface StaffAccessRow {
  id: string;
  departmentId: string | null;
  hasStaffRole: boolean;
}

export async function GET(request: Request) {
  try {
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

    const staffId = new URL(request.url).searchParams.get("staffId")?.trim();
    if (!staffId) {
      return NextResponse.json({ error: "staffId is required." }, { status: 400 });
    }

    const staff = await queryOne<StaffAccessRow>(
      `SELECT
         u.id,
         p.department_id AS "departmentId",
         bool_or(ur.role = 'staff') AS "hasStaffRole"
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       WHERE u.id = $1 AND u.status = 'active'
       GROUP BY u.id, p.department_id`,
      [staffId],
    );
    if (!staff || !staff.hasStaffRole) {
      return NextResponse.json({ error: "Active staff member not found." }, { status: 404 });
    }
    if (!isAdmin) {
      if (staffId === session.user.id) {
        return NextResponse.json(
          { error: "Managers cannot create observations for themselves." },
          { status: 400 },
        );
      }
      const sameDepartment = await queryOne(
        `SELECT 1 FROM profiles WHERE user_id = $1 AND department_id = $2`,
        [session.user.id, staff.departmentId],
      );
      if (!sameDepartment) {
        return NextResponse.json(
          { error: "Managers can only view forms for staff in their department." },
          { status: 403 },
        );
      }
    }

    const forms = await query<ObservationCreationForm>(
      `SELECT
         rt.id,
         rt.name,
         rt.description,
         rt.template_type AS "templateType",
         wd.id AS "workflowId",
         wd.name AS "workflowName",
         COUNT(DISTINCT rs.id)::int AS "sectionCount",
         COUNT(DISTINCT ri.id)::int AS "indicatorCount"
       FROM rubric_templates rt
       JOIN role_workflow_assignments rwa ON rwa.rubric_id = rt.id
       JOIN workflow_definitions wd ON wd.id = rwa.workflow_id
       JOIN department_roles dr ON dr.id = rwa.department_role_id
       JOIN profiles sp ON sp.user_id = $1
       JOIN user_roles sur ON sur.user_id = $1 AND sur.role = dr.role
       LEFT JOIN rubric_sections rs ON rs.template_id = rt.id
       LEFT JOIN rubric_indicators ri ON ri.section_id = rs.id
       WHERE rwa.is_active = true
         AND rt.is_active = true
         AND wd.type = 'CLASSROOM_OBSERVATION'
         AND rt.template_type IN ('CLASSROOM_OBSERVATION', 'GENERIC')
         AND (dr.department_id = sp.department_id OR dr.department_id IS NULL)
       GROUP BY rt.id, rt.name, rt.description, rt.template_type, wd.id, wd.name
       ORDER BY rt.name ASC, wd.name ASC`,
      [staffId],
    );

    return NextResponse.json(forms);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("GET /api/observations/available-forms error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
