// src/app/api/observations/available-forms/route.ts
// Milestone 4: Returns observation rubrics + workflow assignments valid for
// the selected staff member's role (manager cannot use workflows not assigned
// to the staff's role).

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRoles = (session.user as any).roles ?? [];
    const isAdmin = userRoles.includes("admin");
    const isManager = userRoles.includes("manager");

    if (!isAdmin && !isManager) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const staffId = searchParams.get("staffId")?.trim();

    if (!staffId) {
      return NextResponse.json(
        { error: "staffId is required." },
        { status: 400 },
      );
    }

    const forms = (await query(
      `SELECT DISTINCT
         rt.id,
         rt.name,
         rt.template_type AS "templateType",
         rt.description,
         wd.id AS "workflowId",
         wd.name AS "workflowName"
       FROM rubric_templates rt
       JOIN role_workflow_assignments rwa ON rwa.rubric_id = rt.id
       JOIN workflow_definitions wd ON wd.id = rwa.workflow_id
       JOIN department_roles dr ON dr.id = rwa.department_role_id
       JOIN profiles sp ON sp.user_id = $1
       JOIN user_roles sur ON sur.user_id = $1 AND sur.role = dr.role
       WHERE wd.type = 'CLASSROOM_OBSERVATION'
         AND rwa.is_active = true
         AND rt.template_type IN ('CLASSROOM_OBSERVATION', 'GENERIC')
         AND (dr.department_id = sp.department_id OR dr.department_id IS NULL)
         AND (
           $2::boolean = true
           OR sp.department_id = (
             SELECT department_id FROM profiles WHERE user_id = $3
           )
         )
       ORDER BY rt.name ASC`,
      [staffId, isAdmin, session.user.id],
    )) as any[];

    return NextResponse.json(forms);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("GET /api/observations/available-forms error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
