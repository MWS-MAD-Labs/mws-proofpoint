// src/app/api/observations/[id]/route.ts
// Milestone 5: includes audit trail (observation_updates) in response
// so manager/admin can see acknowledgement status history.

import { type NextRequest, NextResponse } from "next/server";
import { getObservationSession } from "@/features/observations/server/auth";
import { pool, query, queryOne } from "@/lib/db";
import { getObservationPermissions } from "@/features/observations/server/permissions";
import { normalizeObservationStatus } from "@/features/observations/server/lifecycle";
import { calculateObservationProgress } from "@/features/observations/server/validation";
import { randomUUID } from "crypto";
import { notifyObservationReassigned } from "@/lib/notifications/observation-notifications";
import type {
  ObservationDetail,
  ObservationDetailResponse,
  ObservationIndicatorForProgress,
  ObservationQuestionType,
  ObservationRubricSection,
  ObservationStatus,
  ObservationStatusInput,
  UpdateObservationInput,
} from "@/features/observations/types";

interface ObservationRow {
  id: string;
  staffId: string;
  managerId: string | null;
  templateId: string;
  status: ObservationStatusInput;
  title: string | null;
  description: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  observationDate: Date | string | null;
  dueAt: Date | string | null;
  reopenedAt: Date | string | null;
  submittedAt: Date | string | null;
  acknowledgedAt: Date | string | null;
  acknowledgementResponse: string | null;
  staffEmail: string | null;
  staffName: string | null;
  staffDepartmentId: string | null;
  staffDepartmentName: string | null;
  managerEmail: string | null;
  managerName: string | null;
}

interface RubricSectionRow {
  sectionId: string;
  sectionName: string;
  weight: number | string | null;
  sectionOrder: number | null;
  indicatorId: string | null;
  indicatorName: string | null;
  indicatorDescription: string | null;
  evidenceGuidance: string | null;
  indicatorOrder: number | null;
  questionType: string | null;
  scoreOptions: unknown;
  isRequired: boolean | null;
}

interface AnswerRow {
  id: string;
  indicatorId: string;
  observationId: string;
  score: number | null;
  note: string | null;
  evidence: string | null;
  textValue: string | null;
  selectedOption: string | null;
  selectedOptions: unknown;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface AuditRow {
  id: string;
  statusFrom: string | null;
  statusTo: string;
  eventType: string;
  notes: string | null;
  createdAt: Date | string;
  updaterId: string | null;
  updaterEmail: string | null;
  updaterName: string | null;
}

function serializeDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function serializeNullableDate(value: Date | string | null): string | null {
  return value ? serializeDate(value) : null;
}

function observationStatus(value: string): ObservationStatus {
  return normalizeObservationStatus(value as ObservationStatusInput);
}

function questionType(value: string | null): ObservationQuestionType {
  return value === "TEXT" || value === "CHOICE" ? value : "SCALE";
}

function stringOptions(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((option): option is string => typeof option === "string")
    : [];
}

function hasIndicator(
  row: RubricSectionRow,
): row is RubricSectionRow & { indicatorId: string; indicatorName: string } {
  return Boolean(row.indicatorId && row.indicatorName);
}

interface ObservationPatchRow {
  id: string;
  staffId: string;
  managerId: string | null;
  status: ObservationStatusInput;
  title: string | null;
  description: string | null;
  observationDate: Date | string | null;
  dueAt: Date | string | null;
  staffEmail: string;
  staffName: string | null;
  rubricName: string;
  managerEmail: string | null;
  managerName: string | null;
}

interface ManagerPatchRow {
  id: string;
  email: string;
  fullName: string | null;
  eligible: boolean;
}

function patchText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new Error(`Text must be ${maxLength} characters or fewer.`);
  }
  return trimmed || null;
}

function patchDate(value: unknown, field: string): Date | null {
  if (value === null || value === "") return null;
  if (typeof value !== "string") throw new Error(`${field} is invalid.`);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`${field} is invalid.`);
  return parsed;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getObservationSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const roles = (session.user as { roles?: string[] }).roles ?? [];
    const isAdmin = roles.includes("admin");
    const isManager = roles.includes("manager");
    if (!isAdmin && !isManager) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as UpdateObservationInput;
    const allowedKeys = ["managerId", "title", "description", "observationDate", "dueAt"];
    const keys = Object.keys(body).filter((key) => allowedKeys.includes(key));
    if (keys.length === 0) {
      return NextResponse.json({ error: "No supported fields were provided." }, { status: 400 });
    }
    if (body.managerId !== undefined && !isAdmin) {
      return NextResponse.json({ error: "Only administrators can reassign managers." }, { status: 403 });
    }

    const observation = await queryOne<ObservationPatchRow>(
      `SELECT
         o.id, o."staffId", o."managerId", o.status, o.title, o.description,
         o.observation_date AS "observationDate", o.due_at AS "dueAt",
         su.email AS "staffEmail", sp.full_name AS "staffName",
         rt.name AS "rubricName", mu.email AS "managerEmail",
         mp.full_name AS "managerName"
       FROM observations o
       JOIN users su ON su.id = o."staffId"
       LEFT JOIN profiles sp ON sp.user_id = su.id
       JOIN rubric_templates rt ON rt.id = o.template_id
       LEFT JOIN users mu ON mu.id = o."managerId"
       LEFT JOIN profiles mp ON mp.user_id = mu.id
       WHERE o.id = $1`,
      [id],
    );
    if (!observation) {
      return NextResponse.json({ error: "Observation not found." }, { status: 404 });
    }
    if (!isAdmin && observation.managerId !== session.user.id) {
      return NextResponse.json(
        { error: "Only the assigned manager can edit this observation." },
        { status: 403 },
      );
    }
    const hasMetadataChanges = keys.some((key) => key !== "managerId");
    if (hasMetadataChanges && observation.status !== "draft") {
      return NextResponse.json(
        { error: "Observation metadata can only be changed while it is a draft." },
        { status: 400 },
      );
    }

    const title = body.title !== undefined ? patchText(body.title, 200) : observation.title;
    const description = body.description !== undefined
      ? patchText(body.description, 2000)
      : observation.description;
    const observationDate = body.observationDate !== undefined
      ? patchDate(body.observationDate, "Observation date")
      : observation.observationDate
        ? new Date(observation.observationDate)
        : null;
    const dueAt = body.dueAt !== undefined
      ? patchDate(body.dueAt, "Due date")
      : observation.dueAt
        ? new Date(observation.dueAt)
        : null;
    if (observationDate && dueAt && dueAt < observationDate) {
      return NextResponse.json(
        { error: "Due date cannot precede the observation date." },
        { status: 400 },
      );
    }

    let managerId = observation.managerId;
    let newManager: ManagerPatchRow | null = null;
    if (body.managerId !== undefined) {
      managerId = body.managerId.trim();
      if (!managerId) {
        return NextResponse.json({ error: "managerId cannot be empty." }, { status: 400 });
      }
      if (managerId === observation.staffId) {
        return NextResponse.json(
          { error: "The assigned manager cannot be the observation subject." },
          { status: 400 },
        );
      }
      newManager = await queryOne<ManagerPatchRow>(
        `SELECT
           u.id, u.email, p.full_name AS "fullName",
           bool_or(ur.role IN ('manager', 'admin')) AS eligible
         FROM users u
         LEFT JOIN profiles p ON p.user_id = u.id
         LEFT JOIN user_roles ur ON ur.user_id = u.id
         WHERE u.id = $1 AND u.status = 'active'
         GROUP BY u.id, u.email, p.full_name`,
        [managerId],
      );
      if (!newManager?.eligible) {
        return NextResponse.json(
          { error: "Assigned manager must be an active manager or administrator." },
          { status: 400 },
        );
      }
    }

    const reassigned = managerId !== observation.managerId;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `UPDATE observations
         SET "managerId" = $2, title = $3, description = $4,
             observation_date = $5, due_at = $6, updated_at = NOW()
         WHERE id = $1`,
        [id, managerId, title, description, observationDate, dueAt],
      );
      if (reassigned) {
        await client.query(
          `INSERT INTO observation_updates
             (id, observation_id, updated_by_id, status_from, status_to, event_type, notes, created_at)
           VALUES ($1, $2, $3, $4, $4, 'reassigned', $5, NOW())`,
          [
            randomUUID(),
            id,
            session.user.id,
            normalizeObservationStatus(observation.status),
            `Manager reassigned from ${observation.managerName ?? observation.managerEmail ?? "Unassigned"} to ${newManager?.fullName ?? newManager?.email ?? "Unassigned"}`,
          ],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    if (reassigned && newManager) {
      const staffName = observation.staffName ?? observation.staffEmail;
      await Promise.all([
        observation.managerEmail
          ? notifyObservationReassigned(
              observation.managerEmail,
              observation.managerName ?? observation.managerEmail,
              staffName,
              observation.rubricName,
              id,
              false,
            ).catch((error: unknown) => console.error("Old manager notification error:", error))
          : Promise.resolve(),
        notifyObservationReassigned(
          newManager.email,
          newManager.fullName ?? newManager.email,
          staffName,
          observation.rubricName,
          id,
          true,
        ).catch((error: unknown) => console.error("New manager notification error:", error)),
      ]);
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("PATCH /api/observations/[id] error:", error);
    const status = message.includes("characters or fewer") || message.includes("is invalid") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getObservationSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const roles = (session.user as { roles?: string[] }).roles ?? [];
    const isAdmin = roles.includes("admin");
    const { id } = await params;
    const observation = await queryOne<{
      managerId: string | null;
      status: ObservationStatusInput;
      acknowledgedAt: Date | string | null;
    }>(
      `SELECT "managerId", status, acknowledged_at AS "acknowledgedAt"
       FROM observations
       WHERE id = $1`,
      [id],
    );

    if (!observation) {
      return NextResponse.json({ error: "Observation not found." }, { status: 404 });
    }
    if (
      normalizeObservationStatus(observation.status, observation.acknowledgedAt) ===
      "acknowledged"
    ) {
      return NextResponse.json(
        { error: "Completed observations cannot be deleted." },
        { status: 409 },
      );
    }
    if (!isAdmin && observation.managerId !== session.user.id) {
      return NextResponse.json(
        { error: "Only an administrator or the assigned manager can delete this observation." },
        { status: 403 },
      );
    }

    const deleted = await queryOne<{ id: string }>(
      `DELETE FROM observations
       WHERE id = $1
         AND status IN ('draft', 'pending', 'submitted', 'reviewed')
         AND NOT (status = 'reviewed' AND acknowledged_at IS NOT NULL)
         AND ($2::boolean OR "managerId" = $3)
       RETURNING id`,
      [id, isAdmin, session.user.id],
    );
    if (!deleted) {
      return NextResponse.json(
        { error: "The observation was completed or changed before it could be deleted. Refresh and try again." },
        { status: 409 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("DELETE /api/observations/[id] error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getObservationSession();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = {
      id: session.user.id as string,
      roles: ((session.user as { roles?: string[] }).roles ?? []) as string[],
    };
    const { id } = await params;

    const observation = await queryOne<ObservationRow>(
      `SELECT
         o.id,
         o."staffId",
         o."managerId",
         o.template_id     AS "templateId",
         o.status,
         o.title,
         o.description,
         o.created_at      AS "createdAt",
         o.updated_at      AS "updatedAt",
         o.observation_date AS "observationDate",
         o.due_at          AS "dueAt",
         o.reopened_at     AS "reopenedAt",
         o.submitted_at    AS "submittedAt",
         o.acknowledged_at AS "acknowledgedAt",
         o.acknowledgement_response AS "acknowledgementResponse",
         su.email          AS "staffEmail",
         sp.full_name      AS "staffName",
         sp.department_id  AS "staffDepartmentId",
         sd.name           AS "staffDepartmentName",
         mu.email          AS "managerEmail",
         mp.full_name      AS "managerName"
       FROM observations o
       LEFT JOIN users su       ON su.id = o."staffId"
       LEFT JOIN profiles sp    ON sp.user_id = su.id
       LEFT JOIN departments sd ON sd.id = sp.department_id
       LEFT JOIN users mu       ON mu.id = o."managerId"
       LEFT JOIN profiles mp ON mp.user_id = mu.id
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

    if (!permissions.canViewRecord)
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });

    // ── Rubric sections + indicators ──────────────────────────────────────────
    const rubricSections = await query<RubricSectionRow>(
      `SELECT
         rs.id             AS "sectionId",
         rs.name           AS "sectionName",
         rs.weight,
         rs.sort_order     AS "sectionOrder",
         ri.id             AS "indicatorId",
         ri.name           AS "indicatorName",
         ri.description    AS "indicatorDescription",
         ri.evidence_guidance AS "evidenceGuidance",
         ri.sort_order     AS "indicatorOrder",
         ri.question_type  AS "questionType",
         ri.score_options  AS "scoreOptions",
         ri.is_required    AS "isRequired"
       FROM rubric_sections rs
       LEFT JOIN rubric_indicators ri ON ri.section_id = rs.id
       WHERE rs.template_id = $1
       ORDER BY rs.sort_order ASC, ri.sort_order ASC`,
      [observation.templateId],
    );

    const rubricName = await queryOne<{ name: string }>(
      `SELECT name FROM rubric_templates WHERE id = $1`,
      [observation.templateId],
    );

    const sectionsMap: Record<string, ObservationRubricSection> = {};
    for (const row of rubricSections) {
      if (!sectionsMap[row.sectionId]) {
        sectionsMap[row.sectionId] = {
          id: row.sectionId,
          name: row.sectionName,
          weight: row.weight == null ? null : Number(row.weight),
          sortOrder: Number(row.sectionOrder ?? 0),
          indicators: [],
        };
      }
      if (row.indicatorId) {
        sectionsMap[row.sectionId].indicators.push({
          id: row.indicatorId,
          name: row.indicatorName ?? "Untitled indicator",
          description: row.indicatorDescription,
          evidenceGuidance: row.evidenceGuidance,
          sortOrder: Number(row.indicatorOrder ?? 0),
          questionType: questionType(row.questionType),
          scoreOptions: stringOptions(row.scoreOptions),
          isRequired: row.isRequired ?? true,
        });
      }
    }

    // ── Answers ───────────────────────────────────────────────────────────────
    const answers = permissions.canViewResponses
      ? await query<AnswerRow>(
          `SELECT
             id,
             indicator_id AS "indicatorId",
             observation_id AS "observationId",
             score,
             note,
             evidence,
             text_value AS "textValue",
             selected_option AS "selectedOption",
             selected_options AS "selectedOptions",
             created_at AS "createdAt",
             updated_at AS "updatedAt"
           FROM observation_answers
           WHERE observation_id = $1`,
          [id],
        )
      : [];

    const normalizedAnswers = answers.map((answer) => ({
      id: answer.id,
      indicatorId: answer.indicatorId,
      observationId: answer.observationId,
      score: answer.score,
      note: answer.note,
      evidence: answer.evidence,
      textValue: answer.textValue,
      selectedOption: answer.selectedOption,
      selectedOptions: stringOptions(answer.selectedOptions).length
        ? stringOptions(answer.selectedOptions)
        : null,
      createdAt: serializeDate(answer.createdAt),
      updatedAt: serializeDate(answer.updatedAt),
    }));

    const answersByIndicator = new Map(
      normalizedAnswers.map((answer) => [answer.indicatorId, answer]),
    );
    const progressIndicators: ObservationIndicatorForProgress[] =
      rubricSections
        .filter(hasIndicator)
        .map((row) => ({
          id: row.indicatorId,
          name: row.indicatorName,
          sectionId: row.sectionId,
          sectionName: row.sectionName,
          questionType: questionType(row.questionType),
          isRequired: row.isRequired ?? true,
          scoreOptions: stringOptions(row.scoreOptions),
          answer: answersByIndicator.get(row.indicatorId) ?? null,
        }));
    const progress = permissions.canViewResponses
      ? calculateObservationProgress(progressIndicators)
      : null;

    // ── Audit trail (Milestone 5 AC: manager/admin can see acknowledgement status) ──
    const auditRows = await query<AuditRow>(
      `SELECT
         ou.id,
         ou.status_from  AS "statusFrom",
         ou.status_to    AS "statusTo",
         ou.event_type   AS "eventType",
         ou.notes,
         ou.created_at   AS "createdAt",
         u.id            AS "updaterId",
         u.email         AS "updaterEmail",
         p.full_name     AS "updaterName"
       FROM observation_updates ou
       LEFT JOIN users u    ON u.id = ou.updated_by_id
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE ou.observation_id = $1
       ORDER BY ou.created_at ASC`,
      [id],
    );

    const auditTrail = auditRows.map((row) => ({
      id: row.id,
      eventType: row.eventType,
      statusFrom: row.statusFrom ? observationStatus(row.statusFrom) : null,
      statusTo: observationStatus(row.statusTo),
      notes: row.notes,
      createdAt: serializeDate(row.createdAt),
      updatedBy: row.updaterId
        ? {
            id: row.updaterId,
            email: row.updaterEmail ?? "",
            profile: { fullName: row.updaterName },
          }
        : null,
    }));
    if (!auditTrail.some((entry) => entry.eventType === "created")) {
      auditTrail.unshift({
        id: `created-${observation.id}`,
        eventType: "created",
        statusFrom: null,
        statusTo: "draft",
        notes: "Observation created",
        createdAt: serializeDate(observation.createdAt),
        updatedBy: observation.managerId
          ? {
              id: observation.managerId,
              email: observation.managerEmail ?? "",
              profile: { fullName: observation.managerName },
            }
          : null,
      });
    }

    const observationDetail: ObservationDetail = {
      id: String(observation.id),
      staffId: String(observation.staffId),
      managerId: observation.managerId ? String(observation.managerId) : null,
      templateId: String(observation.templateId),
      status: normalizeObservationStatus(
        observation.status,
        observation.acknowledgedAt,
      ),
      title: observation.title,
      description: observation.description,
      createdAt: serializeDate(observation.createdAt),
      updatedAt: serializeDate(observation.updatedAt),
      observationDate: serializeNullableDate(observation.observationDate),
      dueAt: serializeNullableDate(observation.dueAt),
      reopenedAt: serializeNullableDate(observation.reopenedAt),
      submittedAt: serializeNullableDate(observation.submittedAt),
      acknowledgedAt: serializeNullableDate(observation.acknowledgedAt),
      acknowledgementResponse: observation.acknowledgementResponse,
      staff: {
        id: observation.staffId,
        email: observation.staffEmail ?? "",
        profile: {
          fullName: observation.staffName,
          department: observation.staffDepartmentId
            ? {
                id: observation.staffDepartmentId,
                name: observation.staffDepartmentName ?? "Unassigned",
              }
            : null,
        },
      },
      manager: observation.managerId
        ? {
            id: observation.managerId,
            email: observation.managerEmail ?? "",
            profile: { fullName: observation.managerName },
          }
        : null,
      rubric: {
        id: observation.templateId,
        name: rubricName?.name ?? "",
        sections: Object.values(sectionsMap),
      },
      ...(permissions.canViewResponses ? { answers: normalizedAnswers } : {}),
      activity: auditTrail,
      progress,
    };

    const response: ObservationDetailResponse = {
      observation: observationDetail,
      permissions,
    };
    return NextResponse.json(response);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("GET /api/observations/[id] error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
