// src/app/api/observations/[id]/submit/route.ts
// Milestone 4: Only the manager who owns the observation can submit it.
// On submit, status moves draft → submitted, and staff is notified.

import { type NextRequest, NextResponse } from "next/server";
import { getObservationSession } from "@/features/observations/server/auth";
import { pool, query, queryOne } from "@/lib/db";
import { getObservationPermissions } from "@/features/observations/server/permissions";
import { assertObservationTransition } from "@/features/observations/server/lifecycle";
import { findIncompleteRequiredIndicators } from "@/features/observations/server/validation";
import type {
  ObservationIndicatorForProgress,
  ObservationQuestionType,
  ObservationStatus,
} from "@/features/observations/types";
import { notifyObservationSubmitted } from "@/lib/notifications/observation-notifications";
import { randomUUID } from "crypto";

interface SubmitObservationRow {
  id: string;
  staffId: string;
  managerId: string | null;
  templateId: string;
  status: ObservationStatus;
  staffEmail: string;
  staffName: string | null;
  managerName: string | null;
  managerEmail: string | null;
  rubricName: string | null;
  title: string | null;
}

interface SubmitIndicatorRow {
  sectionId: string;
  sectionName: string;
  indicatorId: string;
  indicatorName: string;
  questionType: string | null;
  isRequired: boolean | null;
  scoreOptions: unknown;
  score: number | null;
  textValue: string | null;
  selectedOption: string | null;
}

interface SubmittedObservationRow {
  id: string;
  status: ObservationStatus;
  submittedAt: Date | string;
  acknowledgedAt: Date | string | null;
}

function questionType(value: string | null): ObservationQuestionType {
  return value === "TEXT" || value === "CHOICE" ? value : "SCALE";
}

function stringOptions(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((option): option is string => typeof option === "string")
    : [];
}

function serializeDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getObservationSession();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = {
      id: session.user.id,
      roles: (session.user as { roles?: string[] }).roles ?? [],
    };
    const isAdmin = user.roles.includes("admin");
    const { id } = await params;

    // Load observation
    const observation = await queryOne<SubmitObservationRow>(
      `SELECT
         o.id,
         o."staffId",
         o."managerId",
         o.template_id AS "templateId",
         o.status,
         su.email AS "staffEmail",
         sp.full_name AS "staffName",
         mu.email AS "managerEmail",
         mp.full_name AS "managerName",
         rt.name AS "rubricName",
         o.title
       FROM observations o
       JOIN users su ON su.id = o."staffId"
       LEFT JOIN profiles sp ON sp.user_id = su.id
       LEFT JOIN users mu ON mu.id = o."managerId"
       LEFT JOIN profiles mp ON mp.user_id = mu.id
       LEFT JOIN rubric_templates rt ON rt.id = o.template_id
       WHERE o.id = $1`,
      [id],
    );

    if (!observation)
      return NextResponse.json(
        { error: "Observation not found." },
        { status: 404 },
      );

    const permissions = getObservationPermissions(user, {
      status: observation.status,
      staffId: String(observation.staffId),
      managerId: observation.managerId ? String(observation.managerId) : null,
    });

    if (!permissions.canSubmit)
      return NextResponse.json(
        {
          error:
            observation.status === "draft"
              ? "Forbidden: only the assigned observer can submit this observation."
              : "Only draft observations can be submitted.",
        },
        { status: observation.status === "draft" ? 403 : 400 },
      );

    assertObservationTransition("draft", "submitted");

    const indicatorRows = await query<SubmitIndicatorRow>(
      `SELECT
         rs.id AS "sectionId",
         rs.name AS "sectionName",
         ri.id AS "indicatorId",
         ri.name AS "indicatorName",
         ri.question_type AS "questionType",
         ri.is_required AS "isRequired",
         ri.score_options AS "scoreOptions",
         oa.score,
         oa.text_value AS "textValue",
         oa.selected_option AS "selectedOption"
       FROM rubric_sections rs
       JOIN rubric_indicators ri ON ri.section_id = rs.id
       LEFT JOIN observation_answers oa
         ON oa.observation_id = $1 AND oa.indicator_id = ri.id
       WHERE rs.template_id = $2
       ORDER BY rs.sort_order ASC, ri.sort_order ASC`,
      [id, observation.templateId],
    );

    const indicators: ObservationIndicatorForProgress[] = indicatorRows.map(
      (row) => ({
        id: row.indicatorId,
        name: row.indicatorName,
        sectionId: row.sectionId,
        sectionName: row.sectionName,
        questionType: questionType(row.questionType),
        isRequired: row.isRequired ?? true,
        scoreOptions: stringOptions(row.scoreOptions),
        answer: {
          score: row.score,
          textValue: row.textValue,
          selectedOption: row.selectedOption,
        },
      }),
    );
    const incomplete = findIncompleteRequiredIndicators(indicators);

    if (incomplete.length > 0) {
      return NextResponse.json(
        {
          error: "Observation is incomplete.",
          code: "INCOMPLETE_REQUIRED_INDICATORS",
          incomplete,
        },
        { status: 422 },
      );
    }

    const client = await pool.connect();
    let updated: SubmittedObservationRow;
    try {
      await client.query("BEGIN");
      const updateResult = await client.query<SubmittedObservationRow>(
        `UPDATE observations
         SET status = 'submitted',
             submitted_at = NOW(),
             acknowledged_at = NULL,
             acknowledgement_response = NULL,
             acknowledgement_method = NULL,
             acknowledgement_note = NULL,
             acknowledgement_automation_started_at = NOW(),
             updated_at = NOW()
         WHERE id = $1 AND status = 'draft'
         RETURNING
           id,
           status,
           submitted_at AS "submittedAt",
           acknowledged_at AS "acknowledgedAt"`,
        [id],
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) throw new Error("Observation status changed before submit.");
      updated = updatedRow;

      await client.query(
        `INSERT INTO observation_updates
           (id, observation_id, updated_by_id, status_from, status_to, event_type, notes, created_at)
         VALUES ($1, $2, $3, 'draft', 'submitted', 'submitted', $4, NOW())`,
        [
          randomUUID(),
          id,
          user.id,
          `Submitted by ${isAdmin ? "admin" : "manager"}`,
        ],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    // Notify staff
    await notifyObservationSubmitted(
      observation.staffId,
      observation.staffEmail,
      observation.staffName ?? observation.staffEmail,
      observation.managerName ?? observation.managerEmail ?? "Observer",
      observation.title?.trim() || observation.rubricName || "Observation",
      id,
    ).catch((err: unknown) => console.error("Submit notification error:", err));

    return NextResponse.json({
      id: updated.id,
      status: updated.status,
      submittedAt: serializeDate(updated.submittedAt),
      acknowledgedAt: updated.acknowledgedAt
        ? serializeDate(updated.acknowledgedAt)
        : null,
      permissions: getObservationPermissions(user, {
        status: "submitted",
        staffId: String(observation.staffId),
        managerId: observation.managerId ? String(observation.managerId) : null,
      }),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("PATCH /api/observations/[id]/submit error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
