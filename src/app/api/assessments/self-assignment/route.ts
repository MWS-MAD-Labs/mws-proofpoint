import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { getAutomaticPeriod } from "@/lib/utils";

type SelfAssessmentAssignment = {
  templateId: string;
  templateName: string;
};

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const assignment = await queryOne<SelfAssessmentAssignment>(
      `SELECT rt.id::text AS "templateId", rt.name AS "templateName"
         FROM department_role_memberships drm
         JOIN department_roles dr ON dr.id = drm.department_role_id
         JOIN role_workflow_assignments rwa
           ON rwa.department_role_id = dr.id
          AND rwa.is_active = true
         JOIN workflow_definitions wd
           ON wd.id = rwa.workflow_id
          AND wd.type = 'KPI_APPRAISAL'
         JOIN rubric_templates rt
           ON rt.id = rwa.rubric_id
          AND rt.is_active = true
          AND rt.template_type IN ('KPI_APPRAISAL', 'GENERIC')
        WHERE drm.user_id = $1
        ORDER BY
          CASE WHEN dr.department_id IS NOT NULL THEN 0 ELSE 1 END,
          CASE WHEN dr.role = 'manager' THEN 0 ELSE 1 END,
          rwa.created_at ASC
        LIMIT 1`,
      [session.user.id],
    );

    if (assignment) {
      return NextResponse.json({
        data: {
          ...assignment,
          period: getAutomaticPeriod(),
        },
      });
    }

    const legacyAssignment = await queryOne<SelfAssessmentAssignment>(
      `SELECT rt.id::text AS "templateId", rt.name AS "templateName"
         FROM department_role_memberships drm
         JOIN department_roles dr ON dr.id = drm.department_role_id
         JOIN rubric_templates rt
           ON rt.id = dr.default_template_id
          AND rt.is_active = true
          AND rt.template_type IN ('KPI_APPRAISAL', 'GENERIC')
        WHERE drm.user_id = $1
        ORDER BY
          CASE WHEN dr.department_id IS NOT NULL THEN 0 ELSE 1 END,
          CASE WHEN dr.role = 'manager' THEN 0 ELSE 1 END,
          dr.updated_at DESC
        LIMIT 1`,
      [session.user.id],
    );

    return NextResponse.json({
      data: {
        templateId: legacyAssignment?.templateId ?? null,
        templateName: legacyAssignment?.templateName ?? null,
        period: getAutomaticPeriod(),
      },
    });
  } catch (error) {
    console.error("Self-assessment assignment error:", error);
    return NextResponse.json(
      { error: "Failed to resolve self-assessment assignment" },
      { status: 500 },
    );
  }
}
