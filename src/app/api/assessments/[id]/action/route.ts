import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import { pool } from "@/lib/db";
import { getAssessmentPermissions } from "@/features/assessments/server/permissions";
import { nextManagerLedTransition, type AssessmentAction } from "@/features/assessments/server/lifecycle";
import { triggerNotification } from "@/lib/notifications";
import { calculateWeightedPercentageScore, getGradeFromScore } from "@/features/assessments/scoring";

const actions = new Set<AssessmentAction>(["save_draft", "submit", "director_review", "return", "acknowledge"]);

function isValidRating(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 4;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const action = body.action as AssessmentAction;
  if (!actions.has(action)) return NextResponse.json({ error: "Invalid appraisal action" }, { status: 400 });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(`SELECT id, staff_id AS "staffId", manager_id AS "managerId", director_id AS "directorId", template_id AS "templateId", status, workflow_snapshot AS "workflowSnapshot" FROM assessments WHERE id = $1 FOR UPDATE`, [id]);
    const assessment = result.rows[0];
    if (!assessment) throw Object.assign(new Error("Assessment not found"), { statusCode: 404 });
    const roles = ((session.user as { roles?: string[] }).roles ?? []) as string[];
    const permissions = getAssessmentPermissions({ id: session.user.id, roles }, assessment);
    const requiredPermission = action === "save_draft" ? "canSaveDraft" : action === "submit" ? "canSubmit" : action === "director_review" ? "canDirectorReview" : action === "return" ? "canReturn" : "canAcknowledge";
    if (!permissions[requiredPermission]) throw Object.assign(new Error("You cannot perform this action at the current workflow step"), { statusCode: 403 });
    const nextStatus = nextManagerLedTransition(assessment.status, action);
    if (!nextStatus) throw Object.assign(new Error("Invalid appraisal lifecycle transition"), { statusCode: 409 });

    const managerNotes = typeof body.managerNotes === "string" ? body.managerNotes.trim() : undefined;
    const directorComments = typeof body.directorComments === "string" ? body.directorComments.trim() : undefined;
    const staffNotes = typeof body.staffNotes === "string" ? body.staffNotes.trim() : undefined;
    const returnFeedback = typeof body.returnFeedback === "string" ? body.returnFeedback.trim() : undefined;
    if (action === "submit" && !managerNotes) throw Object.assign(new Error("Manager feedback is required before submission"), { statusCode: 400 });
    if (action === "director_review" && !directorComments) throw Object.assign(new Error("Director comments are required"), { statusCode: 400 });
    if (action === "return" && !returnFeedback) throw Object.assign(new Error("Return feedback is required"), { statusCode: 400 });
    if (action === "acknowledge" && !staffNotes) throw Object.assign(new Error("Acknowledgement comments are required"), { statusCode: 400 });

    const fields: string[] = ["status = $2", "updated_at = NOW()"];
    const values: unknown[] = [id, nextStatus];
    let p = 3;
    const add = (column: string, value: unknown) => { fields.push(`${column} = $${p++}`); values.push(value); };
    if (action === "save_draft" || action === "submit") {
      if (body.managerScores !== undefined) add("manager_scores", JSON.stringify(body.managerScores));
      if (body.managerEvidence !== undefined) add("manager_evidence", JSON.stringify(body.managerEvidence));
      if (managerNotes !== undefined) add("manager_notes", managerNotes);
    }
    if (action === "submit") {
      const managerScores = body.managerScores;
      if (!managerScores || typeof managerScores !== "object" || Array.isArray(managerScores)) {
        throw Object.assign(new Error("A rating is required for every performance item before submission"), { statusCode: 400 });
      }

      const kpis = await client.query<{ id: string; performanceWeight: number }>(
        `SELECT id, performance_weight AS "performanceWeight"
         FROM kpis
         WHERE template_id = $1
         ORDER BY sort_order`,
        [assessment.templateId],
      );
      const scoreByKpi = managerScores as Record<string, unknown>;
      const scoredKpis = kpis.rows.map((kpi) => ({
        managerScore: scoreByKpi[kpi.id],
        performanceWeight: kpi.performanceWeight,
      }));
      if (scoredKpis.length === 0 || scoredKpis.some((kpi) => !isValidRating(kpi.managerScore))) {
        throw Object.assign(new Error("A rating from 1 to 4 is required for every performance item before submission"), { statusCode: 400 });
      }
      const finalScore = calculateWeightedPercentageScore(
        scoredKpis.map((kpi) => ({
          managerScore: kpi.managerScore as number,
          performanceWeight: kpi.performanceWeight,
        })),
      );
      if (finalScore === null) throw Object.assign(new Error("Unable to calculate final score"), { statusCode: 400 });

      add("final_score", finalScore);
      add("final_grade", getGradeFromScore(finalScore));
      add("manager_submitted_at", new Date());
      add("current_step_order", 2);
    }
    if (action === "director_review") { add("director_comments", directorComments); add("director_reviewed_at", new Date()); add("current_step_order", 3); }
    if (action === "return") { add("return_feedback", returnFeedback); add("returned_at", new Date()); add("returned_by", session.user.id); add("current_step_order", 1); }
    if (action === "acknowledge") { add("staff_notes", staffNotes); add("acknowledged_at", new Date()); add("completed_at", new Date()); add("current_step_order", 3); }
    const updatedResult = await client.query(`UPDATE assessments SET ${fields.join(", ")} WHERE id = $1 RETURNING *`, values);
    await client.query(`INSERT INTO assessment_updates (id, assessment_id, updated_by_id, step_order, status_from, status_to, event_type, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [randomUUID(), id, session.user.id, action === "submit" ? 2 : action === "director_review" ? 3 : 1, assessment.status, nextStatus, action, directorComments ?? managerNotes ?? staffNotes ?? returnFeedback ?? null]);
    await client.query("COMMIT");
    const notificationStatus = action === "submit" ? "manager_reviewed" : action === "director_review" ? "admin_reviewed" : action === "acknowledge" ? "acknowledged" : null;
    if (notificationStatus) triggerNotification({ assessmentId: id, type: notificationStatus === "manager_reviewed" ? "manager_review_completed" : notificationStatus === "admin_reviewed" ? "admin_released" : "assessment_acknowledged" }).catch(console.error);
    return NextResponse.json({ data: updatedResult.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Assessment lifecycle action error:", error);
    const status = typeof error === "object" && error && "statusCode" in error ? Number((error as { statusCode: number }).statusCode) : 500;
    const message = error instanceof Error && status !== 500 ? error.message : "Failed to update appraisal";
    return NextResponse.json({ error: message }, { status });
  } finally { client.release(); }
}
