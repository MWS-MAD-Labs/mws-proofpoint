// src/app/api/observations/[id]/route.ts
// Milestone 5: includes audit trail (observation_updates) in response
// so manager/admin can see acknowledgement status history.

import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = {
      id: session.user.id as string,
      roles: ((session.user as any).roles ?? []) as string[],
    };
    const { id } = await params;

    const observation = (await queryOne(
      `SELECT
         o.id,
         o."staffId",
         o."managerId",
         o.template_id     AS "templateId",
         o.status,
         o.created_at      AS "createdAt",
         o.updated_at      AS "updatedAt",
         o.submitted_at    AS "submittedAt",
         o.acknowledged_at AS "acknowledgedAt",
         su.id             AS staff_id,
         su.email          AS staff_email,
         sp.full_name      AS staff_name,
         mu.id             AS manager_id,
         mu.email          AS manager_email,
         mp.full_name      AS manager_name
       FROM observations o
       LEFT JOIN users su    ON su.id = o."staffId"
       LEFT JOIN profiles sp ON sp.user_id = su.id
       LEFT JOIN users mu    ON mu.id = o."managerId"
       LEFT JOIN profiles mp ON mp.user_id = mu.id
       WHERE o.id = $1`,
      [id],
    )) as any;

    if (!observation)
      return NextResponse.json(
        { error: "Observation not found." },
        { status: 404 },
      );

    const isAdmin = user.roles.includes("admin");
    const isDirector = user.roles.includes("director");
    // Use String() comparison to avoid UUID vs string type mismatch
    const isManager = String(observation.managerId) === String(user.id);
    const isStaff = String(observation.staffId) === String(user.id);

    if (!isAdmin && !isDirector && !isManager && !isStaff)
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });

    // ── Rubric sections + indicators ──────────────────────────────────────────
    const rubricSections = (await query(
      `SELECT
         rs.id             AS section_id,
         rs.name           AS section_name,
         rs.weight,
         rs.sort_order     AS section_order,
         ri.id             AS indicator_id,
         ri.name           AS indicator_name,
         ri.description    AS indicator_description,
         ri.evidence_guidance,
         ri.sort_order     AS indicator_order,
         ri.question_type,
         ri.score_options
       FROM rubric_sections rs
       LEFT JOIN rubric_indicators ri ON ri.section_id = rs.id
       WHERE rs.template_id = $1
       ORDER BY rs.sort_order ASC, ri.sort_order ASC`,
      [observation.templateId],
    )) as any[];

    const rubricName = (await queryOne(
      `SELECT name FROM rubric_templates WHERE id = $1`,
      [observation.templateId],
    )) as any;

    const sectionsMap: Record<string, any> = {};
    for (const row of rubricSections) {
      if (!sectionsMap[row.section_id]) {
        sectionsMap[row.section_id] = {
          id: row.section_id,
          name: row.section_name,
          weight: row.weight,
          sort_order: row.section_order,
          indicators: [],
        };
      }
      if (row.indicator_id) {
        sectionsMap[row.section_id].indicators.push({
          id: row.indicator_id,
          name: row.indicator_name,
          description: row.indicator_description,
          evidenceGuidance: row.evidence_guidance,
          sort_order: row.indicator_order,
          question_type: row.question_type ?? "SCALE",
          score_options: row.score_options ?? [],
        });
      }
    }

    // ── Answers ───────────────────────────────────────────────────────────────
    const answers = (await query(
      `SELECT * FROM observation_answers WHERE observation_id = $1`,
      [id],
    )) as any[];

    const normalizedAnswers = answers.map((a: any) => ({
      ...a,
      indicatorId: a.indicator_id,
      observationId: a.observation_id,
      textValue: a.text_value ?? null,
      selectedOption: a.selected_option ?? null,
    }));

    // ── Audit trail (Milestone 5 AC: manager/admin can see acknowledgement status) ──
    const auditRows = (await query(
      `SELECT
         ou.id,
         ou.status_from  AS "statusFrom",
         ou.status_to    AS "statusTo",
         ou.notes,
         ou.created_at   AS "createdAt",
         u.id            AS updater_id,
         u.email         AS updater_email,
         p.full_name     AS updater_name
       FROM observation_updates ou
       LEFT JOIN users u    ON u.id = ou.updated_by_id
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE ou.observation_id = $1
       ORDER BY ou.created_at ASC`,
      [id],
    )) as any[];

    const auditTrail = auditRows.map((row: any) => ({
      id: row.id,
      statusFrom: row.statusFrom,
      statusTo: row.statusTo,
      notes: row.notes,
      createdAt: row.createdAt,
      updatedBy: row.updater_id
        ? {
            id: row.updater_id,
            email: row.updater_email,
            profile: { fullName: row.updater_name },
          }
        : null,
    }));

    return NextResponse.json({
      id: observation.id,
      staffId: observation.staffId,
      managerId: observation.managerId,
      templateId: observation.templateId,
      rubricId: observation.templateId,
      status: observation.status,
      createdAt: observation.createdAt,
      updatedAt: observation.updatedAt,
      submittedAt: observation.submittedAt,
      acknowledgedAt: observation.acknowledgedAt,
      staff: observation.staff_id
        ? {
            id: observation.staff_id,
            email: observation.staff_email,
            profile: { fullName: observation.staff_name },
          }
        : null,
      manager: observation.manager_id
        ? {
            id: observation.manager_id,
            email: observation.manager_email,
            profile: { fullName: observation.manager_name },
          }
        : null,
      rubric: {
        id: observation.templateId,
        name: rubricName?.name ?? "",
        sections: Object.values(sectionsMap),
      },
      answers: normalizedAnswers,
      updates: auditTrail, // AC: audit trail for acknowledgement visible to manager/admin
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("GET /api/observations/[id] error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
