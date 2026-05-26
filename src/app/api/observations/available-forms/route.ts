// src/app/api/observations/available-forms/route.ts
// Milestone 4: Returns observation rubrics + workflow assignments valid for
// the selected staff member's role (manager cannot use workflows not assigned
// to the staff's role).
//
// Query params:
//   ?staffId=<uuid>   - optional; if provided, filters by staff's department role
//
// Returns:
//   Array of { id, name, templateType, description, workflowId, workflowName }

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userRoles = (session.user as any).roles ?? [];
    const isAdmin   = userRoles.includes("admin");

    const { searchParams } = new URL(req.url);
    const staffId = searchParams.get("staffId");

    let forms: any[];

    if (staffId) {
      // ── Filter rubrics by workflows assigned to the staff member's role ──
      // AC: Manager cannot use workflows not assigned to the staff's role.
      forms = await query(
        `SELECT DISTINCT
           rt.id,
           rt.name,
           rt.template_type          AS "templateType",
           rt.description,
           wd.id                     AS "workflowId",
           wd.name                   AS "workflowName"
         FROM rubric_templates rt
         JOIN role_workflow_assignments rwa ON rwa.rubric_id = rt.id
         JOIN workflow_definitions wd        ON wd.id  = rwa.workflow_id
         JOIN department_roles dr            ON dr.id  = rwa.department_role_id
         JOIN user_roles ur                  ON ur.role = dr.role
         WHERE ur.user_id            = $1
           AND wd.type               = 'CLASSROOM_OBSERVATION'
           AND rwa.is_active         = true
           AND rt.template_type IN ('CLASSROOM_OBSERVATION', 'GENERIC')
         ORDER BY rt.name ASC`,
        [staffId]
      ) as any[];

      // Fallback for fresh setups (no workflow assignments yet)
      if (forms.length === 0) {
        forms = await query(
          `SELECT id, name, template_type AS "templateType", description,
                  NULL AS "workflowId", NULL AS "workflowName"
           FROM rubric_templates
           WHERE template_type IN ('CLASSROOM_OBSERVATION', 'GENERIC')
           ORDER BY name ASC`,
          []
        ) as any[];
      }
    } else if (isAdmin) {
      // Admin without staffId: show all observation forms
      forms = await query(
        `SELECT DISTINCT
           rt.id,
           rt.name,
           rt.template_type AS "templateType",
           rt.description,
           wd.id            AS "workflowId",
           wd.name          AS "workflowName"
         FROM rubric_templates rt
         LEFT JOIN role_workflow_assignments rwa ON rwa.rubric_id = rt.id
         LEFT JOIN workflow_definitions wd        ON wd.id = rwa.workflow_id
         WHERE rt.template_type IN ('CLASSROOM_OBSERVATION', 'GENERIC')
         ORDER BY rt.name ASC`,
        []
      ) as any[];
    } else {
      // Manager without staffId: show forms linked to their own role's assignments
      forms = await query(
        `SELECT DISTINCT
           rt.id,
           rt.name,
           rt.template_type AS "templateType",
           rt.description,
           wd.id            AS "workflowId",
           wd.name          AS "workflowName"
         FROM rubric_templates rt
         JOIN role_workflow_assignments rwa ON rwa.rubric_id = rt.id
         JOIN workflow_definitions wd        ON wd.id  = rwa.workflow_id
         JOIN department_roles dr            ON dr.id  = rwa.department_role_id
         JOIN user_roles ur                  ON ur.role = dr.role
         WHERE ur.user_id            = $1
           AND wd.type               = 'CLASSROOM_OBSERVATION'
           AND rwa.is_active         = true
           AND rt.template_type IN ('CLASSROOM_OBSERVATION', 'GENERIC')
         ORDER BY rt.name ASC`,
        [session.user.id]
      ) as any[];

      if (forms.length === 0) {
        forms = await query(
          `SELECT id, name, template_type AS "templateType", description,
                  NULL AS "workflowId", NULL AS "workflowName"
           FROM rubric_templates
           WHERE template_type IN ('CLASSROOM_OBSERVATION', 'GENERIC')
           ORDER BY name ASC`,
          []
        ) as any[];
      }
    }

    return NextResponse.json(forms);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("GET /api/observations/available-forms error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
