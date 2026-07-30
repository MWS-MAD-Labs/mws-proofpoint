import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const roles = ((session.user as { roles?: string[] }).roles ?? []) as string[];
  if (!roles.includes("manager") && !roles.includes("admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const staff = await query(
    `SELECT DISTINCT ON (u.id, dr.id)
            u.id,
            u.email,
            p.full_name AS "fullName",
            d.name AS "departmentName",
            dr.id AS "departmentRoleId",
            rt.id AS "templateId",
            rt.name AS "templateName",
            active_assessment.id AS "activeAssessmentId",
            active_assessment.status AS "activeAssessmentStatus"
       FROM users u
       JOIN department_role_memberships staff_membership
         ON staff_membership.user_id = u.id
       JOIN department_roles dr
         ON dr.id = staff_membership.department_role_id
        AND dr.role = 'staff'
        AND dr.department_id IS NOT NULL
       JOIN departments d ON d.id = dr.department_id
       JOIN role_workflow_assignments rwa
         ON rwa.department_role_id = dr.id
        AND rwa.is_active = true
       JOIN rubric_templates rt
         ON rt.id = rwa.rubric_id
        AND rt.template_type = 'STAFF_APPRAISAL'
        AND rt.is_active = true
       JOIN workflow_definitions wd
         ON wd.id = rwa.workflow_id
        AND wd.type = 'KPI_APPRAISAL'
       LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN LATERAL (
         SELECT a.id, a.status
           FROM assessments a
          WHERE a.staff_id = u.id
            AND a.template_id = rt.id
            AND a.period = CASE
              WHEN EXTRACT(MONTH FROM CURRENT_DATE) >= 11 OR EXTRACT(MONTH FROM CURRENT_DATE) <= 2
                THEN 'Semester 1, ' || CASE
                  WHEN EXTRACT(MONTH FROM CURRENT_DATE) >= 11
                    THEN EXTRACT(YEAR FROM CURRENT_DATE)::int || '/' || (EXTRACT(YEAR FROM CURRENT_DATE)::int + 1)
                  ELSE (EXTRACT(YEAR FROM CURRENT_DATE)::int - 1) || '/' || EXTRACT(YEAR FROM CURRENT_DATE)::int
                END
              WHEN EXTRACT(MONTH FROM CURRENT_DATE) BETWEEN 5 AND 8
                THEN 'Semester 2, ' || EXTRACT(YEAR FROM CURRENT_DATE)::int
              WHEN EXTRACT(MONTH FROM CURRENT_DATE) BETWEEN 3 AND 4
                THEN 'Semester 2 Preparation, ' || EXTRACT(YEAR FROM CURRENT_DATE)::int
              ELSE 'Annual Review ' || EXTRACT(YEAR FROM CURRENT_DATE)::int
            END
            AND a.status <> 'acknowledged'
          ORDER BY a.created_at DESC
          LIMIT 1
       ) active_assessment ON TRUE
      WHERE u.status = 'active'
        AND (SELECT COUNT(*) FROM workflow_steps WHERE workflow_id = wd.id) = 3
        AND EXISTS (
          SELECT 1 FROM workflow_steps
           WHERE workflow_id = wd.id AND step_order = 1
             AND actor_role = 'manager' AND action_type = 'FILL_FORM'
        )
        AND EXISTS (
          SELECT 1 FROM workflow_steps
           WHERE workflow_id = wd.id AND step_order = 2
             AND actor_role = 'director' AND action_type IN ('REVIEW', 'APPROVE')
        )
        AND EXISTS (
          SELECT 1 FROM workflow_steps
           WHERE workflow_id = wd.id AND step_order = 3
             AND actor_role = 'staff' AND action_type = 'ACKNOWLEDGE'
        )
        AND (
          $1::boolean
          OR EXISTS (
            SELECT 1
              FROM department_role_memberships manager_membership
              JOIN department_roles manager_role
                ON manager_role.id = manager_membership.department_role_id
               AND manager_role.role = 'manager'
             WHERE manager_membership.user_id = $2
               AND manager_role.department_id = dr.department_id
          )
        )
      ORDER BY u.id, dr.id, rt.id`,
    [roles.includes("admin"), session.user.id],
  );

  return NextResponse.json({ data: staff });
}
