// src/app/api/observations/[id]/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = { id: session.user.id, roles: (session.user as any).roles ?? [] };
    const { id } = await params;

    // Get observation with staff, manager, rubric info
    const observation = await queryOne(
      `SELECT
         o.id, o."staffId", o."managerId", o."rubricId",
         o.status, o.type, o.title, o.description,
         o.created_at as "createdAt", o.updated_at as "updatedAt",
         o.submitted_at as "submittedAt",
         o.acknowledged_at as "acknowledgedAt",
         su.id as staff_id, su.email as staff_email, sp.full_name as staff_name,
         mu.id as manager_id, mu.email as manager_email, mp.full_name as manager_name
       FROM observations o
       LEFT JOIN users su ON su.id = o."staffId"
       LEFT JOIN profiles sp ON sp.user_id = su.id
       LEFT JOIN users mu ON mu.id = o."managerId"
       LEFT JOIN profiles mp ON mp.user_id = mu.id
       WHERE o.id = $1`,
      [id]
    ) as any;

    if (!observation)
      return NextResponse.json({ error: "Observation not found." }, { status: 404 });

    const isAdmin    = user.roles.includes("admin");
    const isDirector = user.roles.includes("director");
    const isManager  = observation.managerId === user.id;
    const isStaff    = observation.staffId   === user.id;

    if (!isAdmin && !isDirector && !isManager && !isStaff)
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });

    // Get rubric with sections and indicators
    const rubricSections = await query(
      `SELECT
         rs.id as section_id, rs.name as section_name,
         rs.weight, rs.sort_order as section_order,
         ri.id as indicator_id, ri.name as indicator_name,
         ri.description as indicator_description,
         ri.evidence_guidance, ri.sort_order as indicator_order,
         ri.question_type, ri.score_options
       FROM rubric_sections rs
       LEFT JOIN rubric_indicators ri ON ri.section_id = rs.id
       WHERE rs.template_id = $1
       ORDER BY rs.sort_order ASC, ri.sort_order ASC`,
      [observation.rubricId]
    ) as any[];

    const rubricName = await queryOne(
      `SELECT name FROM rubric_templates WHERE id = $1`,
      [observation.rubricId]
    ) as any;

    // Build sections tree
    const sectionsMap: Record<string, any> = {};
    for (const row of rubricSections) {
      if (!sectionsMap[row.section_id]) {
        sectionsMap[row.section_id] = {
          id:         row.section_id,
          name:       row.section_name,
          weight:     row.weight,
          sort_order: row.section_order,
          indicators: [],
        };
      }
      if (row.indicator_id) {
        sectionsMap[row.section_id].indicators.push({
          id:               row.indicator_id,
          name:             row.indicator_name,
          description:      row.indicator_description,
          evidenceGuidance: row.evidence_guidance,
          sort_order:       row.indicator_order,
          question_type:    row.question_type ?? "SCALE",
          score_options:    row.score_options ?? [],
        });
      }
    }

    // Get answers
    const answers = await query(
      `SELECT * FROM observation_answers WHERE observation_id = $1`,
      [id]
    ) as any[];

    const normalizedAnswers = answers.map((a: any) => ({
      ...a,
      indicatorId:    a.indicator_id,
      observationId:  a.observation_id,
      textValue:      a.text_value      ?? null,
      selectedOption: a.selected_option ?? null,
    }));

    const mapped = {
      id:          observation.id,
      staffId:     observation.staffId,
      managerId:   observation.managerId,
      rubricId:    observation.rubricId,
      status:      observation.status,
      type:        observation.type,
      title:       observation.title,
      description: observation.description,
      createdAt:   observation.createdAt,
      updatedAt:   observation.updatedAt,
      submittedAt: observation.submittedAt,
      staff:   observation.staff_id   ? { id: observation.staff_id,   email: observation.staff_email,   profile: { fullName: observation.staff_name   } } : null,
      manager: observation.manager_id ? { id: observation.manager_id, email: observation.manager_email, profile: { fullName: observation.manager_name } } : null,
      rubric: {
        id:       observation.rubricId,
        name:     rubricName?.name ?? "",
        sections: Object.values(sectionsMap),
      },
      answers: normalizedAnswers,
    };

    return NextResponse.json(mapped);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("GET /api/observations/[id] error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
