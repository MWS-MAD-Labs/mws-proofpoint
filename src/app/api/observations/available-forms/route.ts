// src/app/api/observations/available-forms/route.ts
// Returns rubric templates that are linked to CLASSROOM_OBSERVATION workflows
// via RoleWorkflowAssignment — filtered by the current user's department role.
// This ensures managers only see forms that have been assigned to their role.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userRoles = (session.user as any).roles ?? [];
    const isAdmin   = userRoles.includes("admin");

    // Admins see all observation forms linked to any workflow assignment
    // Managers see only forms linked to assignments for their department role
    let forms: any[];

    if (isAdmin) {
      // Admin: all rubric templates linked to CLASSROOM_OBSERVATION workflows
      forms = await query(
        `SELECT DISTINCT
           rt.id,
           rt.name,
           rt.template_type as "templateType",
           rt.description
         FROM rubric_templates rt
         JOIN role_workflow_assignments rwa ON rwa.rubric_id = rt.id
         JOIN workflow_definitions wd ON wd.id = rwa.workflow_id
         WHERE wd.type = 'CLASSROOM_OBSERVATION'
           AND rwa.is_active = true
           AND rt.template_type IN ('CLASSROOM_OBSERVATION', 'GENERIC')
         UNION
         -- Also include observation forms not yet assigned (admin can use any)
         SELECT DISTINCT
           rt.id,
           rt.name,
           rt.template_type as "templateType",
           rt.description
         FROM rubric_templates rt
         WHERE rt.template_type = 'CLASSROOM_OBSERVATION'
         ORDER BY name ASC`,
        []
      ) as any[];
    } else {
      // Manager: only forms linked to their department role's workflow assignments
      forms = await query(
        `SELECT DISTINCT
           rt.id,
           rt.name,
           rt.template_type as "templateType",
           rt.description
         FROM rubric_templates rt
         JOIN role_workflow_assignments rwa ON rwa.rubric_id = rt.id
         JOIN workflow_definitions wd ON wd.id = rwa.workflow_id
         JOIN department_roles dr ON dr.id = rwa.department_role_id
         JOIN user_roles ur ON ur.user_id = $1
         WHERE wd.type = 'CLASSROOM_OBSERVATION'
           AND rwa.is_active = true
           AND dr.role = ur.role
           AND rt.template_type IN ('CLASSROOM_OBSERVATION', 'GENERIC')
         ORDER BY rt.name ASC`,
        [session.user.id]
      ) as any[];

      // Fallback: if no assignment found, show all observation forms
      // (so new setups still work before admin configures workflow assignments)
      if (forms.length === 0) {
        forms = await query(
          `SELECT id, name, template_type as "templateType", description
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