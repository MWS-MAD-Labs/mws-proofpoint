import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { triggerNotification } from "@/lib/notifications";
import type { NotificationType } from "@/lib/notifications/types";
import { getAssessmentPermissions } from "@/features/assessments/server/permissions";
import { isManagerLedAssessment } from "@/features/assessments/server/lifecycle";
import { calculateWeightedPercentageScore, getGradeFromScore } from "@/features/assessments/scoring";
import { getAutomaticPeriod } from "@/lib/utils";

function hasEvidence(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  return Array.isArray(value) && value.some(
    (item) =>
      typeof item === "object" && item !== null &&
      "evidence" in item && typeof item.evidence === "string" &&
      item.evidence.trim().length > 0,
  );
}

function isTenthPointRating(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) &&
    value >= 1 && value <= 4 && Math.round(value * 10) === value * 10;
}

interface AssessmentListRow {
  id: string;
  template_id: string | null;
  manager_id: string | null;
  status: string;
  workflow_snapshot: unknown;
  staff_scores: unknown;
  manager_scores: unknown;
  director_scores: unknown;
  staff_roles: string[] | null;
  final_score: number | string | null;
  final_grade: string | null;
  [key: string]: unknown;
}

interface AssessmentKpiWeight {
  id: string;
  templateId: string;
  domainId: string;
  domainWeight: number | string;
  performanceWeight: number | string;
}

function asScoreMap(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}


function calculateLegacyAssessmentScore(
  kpis: AssessmentKpiWeight[],
  scores: Record<string, unknown>,
): number | null {
  const domains = new Map<string, { weight: number; weightedTotal: number; itemWeightTotal: number }>();

  for (const kpi of kpis) {
    const rating = scores[kpi.id];
    if (typeof rating !== "number" || !Number.isFinite(rating)) continue;

    const domainWeight = Number(kpi.domainWeight);
    const itemWeight = Number(kpi.performanceWeight ?? 100);
    if (!Number.isFinite(domainWeight) || !Number.isFinite(itemWeight) || itemWeight < 0) continue;

    const domain = domains.get(kpi.domainId) ?? {
      weight: domainWeight,
      weightedTotal: 0,
      itemWeightTotal: 0,
    };
    domain.weightedTotal += rating * itemWeight;
    domain.itemWeightTotal += itemWeight;
    domains.set(kpi.domainId, domain);
  }

  let weightedTotal = 0;
  let domainWeightTotal = 0;
  for (const domain of domains.values()) {
    if (domain.itemWeightTotal <= 0) continue;
    weightedTotal += (domain.weightedTotal / domain.itemWeightTotal) * domain.weight;
    domainWeightTotal += domain.weight;
  }

  return domainWeightTotal > 0 ? weightedTotal / domainWeightTotal : null;
}

async function hydrateCalculatedScores(assessments: AssessmentListRow[]): Promise<AssessmentListRow[]> {
  const templateIds = Array.from(new Set(
    assessments.map((assessment) => assessment.template_id).filter((id): id is string => Boolean(id)),
  ));
  if (templateIds.length === 0) return assessments;

  const kpis = await query<AssessmentKpiWeight>(
    `SELECT k.id,
            k.template_id AS "templateId",
            kd.id AS "domainId",
            kd.weight AS "domainWeight",
            k.performance_weight AS "performanceWeight"
     FROM kpis k
     JOIN kpi_standards ks ON ks.id = k.standard_id
     JOIN kpi_domains kd ON kd.id = ks.domain_id
     WHERE k.template_id = ANY($1::uuid[])`,
    [templateIds],
  );
  const kpisByTemplate = new Map<string, AssessmentKpiWeight[]>();
  for (const kpi of kpis) {
    const templateKpis = kpisByTemplate.get(kpi.templateId) ?? [];
    templateKpis.push(kpi);
    kpisByTemplate.set(kpi.templateId, templateKpis);
  }

  const submittedStatuses = new Set([
    "manager_reviewed",
    "pending_director_review",
    "admin_reviewed",
    "director_reviewed",
    "director_approved",
    "acknowledged",
  ]);

  return assessments.map((assessment) => {
    if (!assessment.template_id || !submittedStatuses.has(assessment.status)) return assessment;
    const templateKpis = kpisByTemplate.get(assessment.template_id) ?? [];
    if (templateKpis.length === 0) return assessment;

    const managerLed = isManagerLedAssessment(assessment);
    const isDirectSelfAssessment = !managerLed && assessment.manager_id === null;
    const baseScores = asScoreMap(
      isDirectSelfAssessment ? assessment.staff_scores : assessment.manager_scores,
    );
    const scores = isDirectSelfAssessment
      ? { ...baseScores, ...asScoreMap(assessment.director_scores) }
      : baseScores;
    const calculatedScore = managerLed
      ? calculateWeightedPercentageScore(
          templateKpis.map((kpi) => ({
            managerScore: scores[kpi.id] as number | "X" | null | undefined,
            performanceWeight: Number(kpi.performanceWeight),
          })),
        )
      : calculateLegacyAssessmentScore(templateKpis, scores);

    if (calculatedScore === null) return assessment;
    return {
      ...assessment,
      final_score: calculatedScore,
      final_grade: getGradeFromScore(calculatedScore),
    };
  });
}

// GET /api/assessments - List assessments based on user role
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const assessmentId = searchParams.get("id");
    const staffId = searchParams.get("staffId");
    const status = searchParams.get("status");
    const limitParam = searchParams.get("limit");

    // Get single assessment
    if (assessmentId) {
      const assessment = await queryOne<{
        staff_id: string; manager_id: string | null; director_id: string | null; status: string; workflow_snapshot: unknown;
        [key: string]: unknown;
      }>(
        `SELECT a.*,
                rt.name as template_name,
                sp.full_name as staff_name,
                sp.job_title as staff_job_title,
                sp.department_id as staff_department_id,
                d.name as staff_department,
                mp.full_name as manager_name,
                mp.job_title as manager_job_title,
                dp.full_name as director_name,
                dp.job_title as director_job_title
         FROM assessments a
         LEFT JOIN rubric_templates rt ON a.template_id = rt.id
         LEFT JOIN profiles sp ON a.staff_id = sp.user_id
         LEFT JOIN departments d ON sp.department_id = d.id
         LEFT JOIN profiles mp ON a.manager_id = mp.user_id
         LEFT JOIN profiles dp ON a.director_id = dp.user_id
         WHERE a.id = $1`,
        [assessmentId],
      );
      if (!assessment) return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
      const roles = ((session.user as { roles?: string[] }).roles ?? []) as string[];
      const permissions = getAssessmentPermissions(
        { id: session.user.id, roles },
        {
          staffId: assessment.staff_id,
          managerId: assessment.manager_id,
          directorId: assessment.director_id,
          status: assessment.status,
          workflowSnapshot: assessment.workflow_snapshot,
        },
      );
      if (!permissions.canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      return NextResponse.json({ data: { ...assessment, permissions } });
    }

    // Build query based on filters
    let sql = `
      SELECT a.*,
             rt.name as template_name,
             sp.full_name as staff_name,
             sp.job_title as staff_job_title,
             d.name as staff_department,
             mp.full_name as manager_name,
             mp.job_title as manager_job_title,
             (
                SELECT array_agg(role::text ORDER BY role::text)
                FROM user_roles
                WHERE user_id = a.staff_id
             ) as staff_roles
      FROM assessments a
      LEFT JOIN rubric_templates rt ON a.template_id = rt.id
      LEFT JOIN profiles sp ON a.staff_id = sp.user_id
      LEFT JOIN departments d ON sp.department_id = d.id
      LEFT JOIN profiles mp ON a.manager_id = mp.user_id
      WHERE 1=1
    `;
    const params: unknown[] = [];
    let paramIndex = 1;

    // Apply Role-Based Filtering
    const roles = (session.user as { roles?: string[] }).roles || [];
    const departmentId = (session.user as { departmentId?: string })
      .departmentId;
    const userId = session.user.id;

    const isAdmin = roles.includes("admin");
    const isDirector = roles.includes("director");
    const isManager = roles.includes("manager");

    if (isAdmin || isDirector) {
      // Admins and Directors see all assessments
    } else if (isManager) {
      // Manager sees:
      // 1. Staff in their department
      // 2. Assessments they explicitly manage
      // 3. Their own assessments
      sql += ` AND (sp.department_id = $${paramIndex++} OR a.manager_id = $${paramIndex++} OR a.staff_id = $${paramIndex++})`;
      params.push(departmentId ?? null, userId, userId);
    } else {
      // Staff see only their own assessments
      sql += ` AND a.staff_id = $${paramIndex++}`;
      params.push(userId);
    }

    if (staffId) {
      sql += ` AND a.staff_id = $${paramIndex++}`;
      params.push(staffId);
    }

    if (status) {
      sql += ` AND a.status = $${paramIndex++}`;
      params.push(status);
    }

    sql += ` ORDER BY a.created_at DESC`;

    if (limitParam) {
      const parsedLimit = Number.parseInt(limitParam, 10);
      if (!Number.isNaN(parsedLimit) && parsedLimit > 0) {
        const safeLimit = Math.min(parsedLimit, 100);
        sql += ` LIMIT $${paramIndex++}`;
        params.push(safeLimit);
      }
    }

    const assessments = await query<AssessmentListRow>(sql, params);
    const assessmentsWithCalculatedScores = await hydrateCalculatedScores(assessments);
    return NextResponse.json({ data: assessmentsWithCalculatedScores });
  } catch (error) {
    console.error("Assessments error:", error);
    return NextResponse.json(
      { error: "Failed to fetch assessments" },
      { status: 500 },
    );
  }
}

// POST /api/assessments - Create new assessment
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { template_id, manager_id, director_id, staff_id } = body;
    const roles = ((session.user as { roles?: string[] }).roles ?? []) as string[];
    const isManagerLed = typeof staff_id === "string" && staff_id !== session.user.id;
    if (isManagerLed && !roles.some((role) => role === "manager" || role === "admin")) {
      return NextResponse.json({ error: "Only managers can initiate staff appraisals" }, { status: 403 });
    }
    const subjectId = isManagerLed ? staff_id : session.user.id;
    const resolvedPeriod = getAutomaticPeriod();
    let resolvedTemplateId = typeof template_id === "string" ? template_id : null;

    if (!isManagerLed) {
      const assignment = await queryOne<{ templateId: string }>(
        `SELECT rt.id::text AS "templateId"
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
        [subjectId],
      );

      const legacyAssignment = assignment
        ? null
        : await queryOne<{ templateId: string }>(
            `SELECT rt.id::text AS "templateId"
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
            [subjectId],
          );

      resolvedTemplateId = assignment?.templateId ?? legacyAssignment?.templateId ?? null;
      if (!resolvedTemplateId) {
        return NextResponse.json(
          { error: "No active self-assessment rubric is assigned to your department role" },
          { status: 403 },
        );
      }
    } else {
      const assignment = await queryOne<{ templateId: string }>(
        `SELECT rt.id AS "templateId"
           FROM department_role_memberships drm
           JOIN department_roles dr ON dr.id = drm.department_role_id AND dr.role = 'staff'
           JOIN role_workflow_assignments rwa ON rwa.department_role_id = dr.id AND rwa.is_active = true
           JOIN rubric_templates rt ON rt.id = rwa.rubric_id AND rt.template_type = 'STAFF_APPRAISAL' AND rt.is_active = true
          WHERE drm.user_id = $1
            AND ($2::text IS NULL OR rt.id::text = $2)
          ORDER BY rt.name
          LIMIT 1`,
        [subjectId, resolvedTemplateId],
      );
      if (!assignment) {
        return NextResponse.json({ error: "No active staff-appraisal rubric is assigned to this staff member’s department role" }, { status: 403 });
      }
      resolvedTemplateId = assignment.templateId;
    }

    if (!resolvedTemplateId) {
      return NextResponse.json({ error: "Rubric template is required" }, { status: 400 });
    }
    const selectedTemplate = await queryOne<{ template_type: string }>(
      "SELECT template_type FROM rubric_templates WHERE id = $1 AND is_active = true",
      [resolvedTemplateId],
    );
    if (!selectedTemplate) return NextResponse.json({ error: "Rubric template not found" }, { status: 404 });
    if (isManagerLed && selectedTemplate.template_type !== "STAFF_APPRAISAL") {
      return NextResponse.json({ error: "Staff appraisals require a STAFF_APPRAISAL rubric" }, { status: 400 });
    }
    if (!isManagerLed && selectedTemplate.template_type === "STAFF_APPRAISAL") {
      return NextResponse.json({ error: "Staff appraisal rubrics cannot be used for self-assessment" }, { status: 400 });
    }

    // Check for existing non-finalized assessment for this period/template
    const existing = await queryOne(
      `SELECT id FROM assessments
             WHERE staff_id = $1 AND template_id = $2 AND period = $3
             AND status != 'acknowledged'`,
      [subjectId, resolvedTemplateId, resolvedPeriod],
    );

    if (existing) {
      return NextResponse.json(
        {
          error:
            "An active assessment already exists for this period and framework.",
        },
        { status: 400 },
      );
    }

    let workflow: { assignmentId: string; workflowId: string; name: string; steps: unknown } | null = null;
    if (isManagerLed) {
      const subject = await queryOne<{ active: boolean }>(
        `SELECT u.status = 'active' AS active FROM users u WHERE u.id = $1`,
        [subjectId],
      );
      if (!subject?.active) return NextResponse.json({ error: "Selected staff member is not active" }, { status: 400 });
      if (!roles.includes("admin")) {
        const sharesDepartment = await queryOne<{ allowed: boolean }>(
          `SELECT EXISTS (
             SELECT 1
               FROM department_role_memberships manager_membership
               JOIN department_roles manager_role
                 ON manager_role.id = manager_membership.department_role_id
                AND manager_role.role = 'manager'
               JOIN department_role_memberships staff_membership
                 ON staff_membership.user_id = $2
               JOIN department_roles staff_role
                 ON staff_role.id = staff_membership.department_role_id
                AND staff_role.role = 'staff'
                AND staff_role.department_id = manager_role.department_id
              WHERE manager_membership.user_id = $1
           ) AS allowed`,
          [session.user.id, subjectId],
        );
        if (!sharesDepartment?.allowed) {
          return NextResponse.json({ error: "Managers can only appraise staff assigned to one of their department roles" }, { status: 403 });
        }
      }
      workflow = await queryOne(
        `SELECT rwa.id AS "assignmentId", wd.id AS "workflowId", wd.name,
                json_agg(json_build_object('stepOrder', ws.step_order, 'actorRole', ws.actor_role, 'actionType', ws.action_type, 'description', ws.description) ORDER BY ws.step_order) AS steps
         FROM role_workflow_assignments rwa
         JOIN workflow_definitions wd ON wd.id = rwa.workflow_id AND wd.type = 'KPI_APPRAISAL'
         JOIN workflow_steps ws ON ws.workflow_id = wd.id
         JOIN rubric_templates rt ON rt.id = rwa.rubric_id AND rt.template_type = 'STAFF_APPRAISAL'
         JOIN department_roles dr ON dr.id = rwa.department_role_id AND dr.role = 'staff'
         JOIN department_role_memberships drm
           ON drm.department_role_id = dr.id
          AND drm.user_id = $1
         WHERE rwa.rubric_id = $2 AND rwa.is_active = true
         GROUP BY rwa.id, wd.id, wd.name
         HAVING COUNT(*) = 3
            AND bool_and((ws.step_order <> 1) OR (ws.actor_role = 'manager' AND ws.action_type = 'FILL_FORM'))
            AND bool_and((ws.step_order <> 2) OR (ws.actor_role = 'director' AND ws.action_type IN ('REVIEW', 'APPROVE')))
            AND bool_and((ws.step_order <> 3) OR (ws.actor_role = 'staff' AND ws.action_type = 'ACKNOWLEDGE'))
         LIMIT 1`,
        [subjectId, resolvedTemplateId],
      );
      if (!workflow) return NextResponse.json({ error: "No manager-led appraisal workflow is assigned to this staff member and rubric" }, { status: 403 });
    }

    // Auto-assign director if not provided
    let finalDirectorId = director_id;
    if (!finalDirectorId) {
      const director = await queryOne<{ user_id: string }>(
        `SELECT ur.user_id FROM user_roles ur
         JOIN profiles p ON ur.user_id = p.user_id
         WHERE ur.role = 'director'
         LIMIT 1`,
      );
      finalDirectorId = director?.user_id || null;
    }

    if (isManagerLed && !finalDirectorId) {
      return NextResponse.json({ error: "A director is required for a manager-led staff appraisal" }, { status: 400 });
    }

    const newAssessment = await queryOne(
      `INSERT INTO assessments (staff_id, template_id, period, manager_id, director_id, status, workflow_id, workflow_assignment_id, workflow_snapshot, current_step_order, initiated_by_id)
       VALUES ($1, $2, $3, $4, $5, 'draft', $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        subjectId,
        resolvedTemplateId,
        resolvedPeriod,
        isManagerLed ? session.user.id : manager_id ?? null,
        finalDirectorId,
        workflow?.workflowId ?? null,
        workflow?.assignmentId ?? null,
        workflow ? JSON.stringify({ name: workflow.name, steps: workflow.steps }) : null,
        workflow ? 1 : null,
        session.user.id,
      ],
    );

    return NextResponse.json({ data: newAssessment }, { status: 201 });
  } catch (error) {
    console.error("Create assessment error:", error);
    return NextResponse.json(
      { error: "Failed to create assessment" },
      { status: 500 },
    );
  }
}

// PUT /api/assessments - Update assessment
export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Assessment ID required" },
        { status: 400 },
      );
    }

    const existingAssessment = await queryOne<{
      id: string;
      staff_id: string;
      manager_id: string | null;
      director_id: string | null;
      status: string;
      workflow_snapshot: unknown;
    }>("SELECT id, staff_id, manager_id, director_id, status, workflow_snapshot FROM assessments WHERE id = $1", [id]);

    if (!existingAssessment) {
      return NextResponse.json(
        { error: "Assessment not found" },
        { status: 404 },
      );
    }

    if (existingAssessment.workflow_snapshot) {
      return NextResponse.json(
        { error: "Workflow-aware appraisals must use their lifecycle action endpoint." },
        { status: 409 },
      );
    }

    const roles = ((session.user as { roles?: string[] }).roles ?? []).map((role) => role.toLowerCase());
    const isManagerSelfAssessment = existingAssessment.staff_id === session.user.id && roles.includes("manager");

    if (updates.staff_scores !== undefined) {
      if (!updates.staff_scores || typeof updates.staff_scores !== "object" || Array.isArray(updates.staff_scores)) {
        return NextResponse.json({ error: "Assessment scores must be a score map." }, { status: 400 });
      }

      const scores = updates.staff_scores as Record<string, unknown>;
      if (Object.values(scores).some((score) => score !== "X" && !isTenthPointRating(score))) {
        return NextResponse.json({ error: "Ratings must be from 1.0 to 4.0 in 0.1 increments." }, { status: 400 });
      }

      if (isManagerSelfAssessment) {
        const evidence = updates.staff_evidence && typeof updates.staff_evidence === "object" && !Array.isArray(updates.staff_evidence)
          ? updates.staff_evidence as Record<string, unknown>
          : {};
        const missingEvidence = Object.entries(scores).some(
          ([kpiId, score]) => typeof score === "number" && score >= 3 && !hasEvidence(evidence[kpiId]),
        );
        if (missingEvidence) {
          return NextResponse.json({ error: "Supporting evidence is required for every rating of 3.0 or above." }, { status: 400 });
        }
      }
    }

    // Prevent invalid completed state: only the owner can acknowledge, and feedback is mandatory.
    if (updates.status === "acknowledged") {
      if (existingAssessment.staff_id !== session.user.id) {
        return NextResponse.json(
          { error: "Only the assessment owner can acknowledge this review" },
          { status: 403 },
        );
      }

      const acknowledgementText =
        typeof updates.staff_notes === "string"
          ? updates.staff_notes.trim()
          : "";

      if (!acknowledgementText) {
        return NextResponse.json(
          { error: "Staff acknowledgement feedback is required" },
          { status: 400 },
        );
      }

      if (
        !["admin_reviewed", "acknowledged"].includes(existingAssessment.status)
      ) {
        return NextResponse.json(
          {
            error: "Assessment can only be acknowledged after admin release",
          },
          { status: 400 },
        );
      }

      updates.staff_notes = acknowledgementText;
    }

    // Build dynamic update query
    const setClauses: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    const allowedFields = [
      "staff_scores",
      "manager_scores",
      "staff_evidence",
      "manager_evidence",
      "director_scores",
      "director_evidence",
      "manager_notes",
      "director_comments",
      "staff_notes",
      "final_score",
      "final_grade",
      "status",
      "staff_submitted_at",
      "manager_reviewed_at",
      "director_approved_at",
      "return_feedback",
      "returned_at",
      "returned_by",
    ];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        setClauses.push(`${key} = $${paramIndex++}`);
        params.push(
          key.includes("scores") || key.includes("evidence")
            ? JSON.stringify(value)
            : value,
        );
      }
    }

    if (setClauses.length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 },
      );
    }

    setClauses.push("updated_at = now()");
    params.push(id);

    const updated = await queryOne(
      `UPDATE assessments SET ${setClauses.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
      params,
    );

    if (updates.status && updated) {
      const newStatus = updates.status;
      const notificationType = getNotificationTypeForStatus(newStatus);

      if (notificationType) {
        triggerNotification({
          assessmentId: id,
          type: notificationType,
        }).catch((error) => {
          const errorMsg =
            error instanceof Error
              ? error.message
              : "Unknown notification error";
          console.error("[API] Notification trigger failed:", errorMsg);
        });
      }
    }

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("Update assessment error:", error);
    return NextResponse.json(
      { error: "Failed to update assessment" },
      { status: 500 },
    );
  }
}

function getNotificationTypeForStatus(status: string): NotificationType | null {
  switch (status) {
    case "self_submitted":
      return "assessment_submitted";
    case "manager_reviewed":
      return "manager_review_completed";
    case "director_approved":
      return "director_approved";
    case "admin_reviewed":
      return "admin_released";
    case "acknowledged":
      return "assessment_acknowledged";
    case "rejected":
    case "returned":
      return "assessment_returned";
    default:
      return null;
  }
}

// DELETE /api/assessments - Delete assessment
export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Assessment ID required" },
        { status: 400 },
      );
    }

    // Fetch assessment to check ownership and status
    const assessment = await queryOne<{ staff_id: string; manager_id: string | null; status: string }>(
      "SELECT staff_id, manager_id, status FROM assessments WHERE id = $1",
      [id],
    );

    if (!assessment) {
      return NextResponse.json(
        { error: "Assessment not found" },
        { status: 404 },
      );
    }

    const isAdmin = (
      (session.user as { roles?: string[] }).roles ?? []
    ).includes("admin");
    const isOwner = assessment.staff_id === session.user.id;
    const isAssignedManager = assessment.manager_id === session.user.id;
    const isDraft =
      assessment.status === "draft" ||
      assessment.status === "rejected" ||
      assessment.status === "returned";

    // Permissions:
    // 1. Admin can delete anything
    // 2. Owner can delete if it's still a draft/rejected
    if (!isAdmin && !((isOwner || isAssignedManager) && isDraft)) {
      return NextResponse.json(
        {
          error:
            "You don't have permission to delete this assessment. Only the subject or assigned manager can delete a draft."
        },
        { status: 403 },
      );
    }

    await query("DELETE FROM assessments WHERE id = $1", [id]);

    return NextResponse.json({ message: "Assessment deleted successfully" });
  } catch (error) {
    console.error("Delete assessment error:", error);
    return NextResponse.json(
      { error: "Failed to delete assessment" },
      { status: 500 },
    );
  }
}
