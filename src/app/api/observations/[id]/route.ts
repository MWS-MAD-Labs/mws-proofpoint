// src/app/api/observations/[id]/route.ts
// Milestone 5: includes audit trail (observation_updates) in response
// so manager/admin can see acknowledgement status history.

import { type NextRequest, NextResponse } from "next/server";
import { getObservationSession } from "@/features/observations/server/auth";
import { pool, query, queryOne } from "@/lib/db";
import { getObservationPermissions } from "@/features/observations/server/permissions";
import { normalizeObservationStatus } from "@/features/observations/server/lifecycle";
import { calculateObservationProgress } from "@/features/observations/server/validation";
import {
  dateOnlyToIso,
  normalizeDateOnly,
} from "@/features/observations/server/dates";
import { randomUUID } from "crypto";
import { notifyObservationReassigned } from "@/lib/notifications/observation-notifications";
import type {
  ObservationDetail,
  ObservationDetailResponse,
  ObservationAcknowledgementMethod,
  ObservationIndicatorForProgress,
  ObservationParticipantDetail,
  ObservationScopeType,
  ObservationQuestionType,
  ObservationRubricSection,
  ObservationStatus,
  ObservationStatusInput,
  UpdateObservationInput,
} from "@/features/observations/types";

interface ObservationRow {
  id: string;
  managerId: string | null;
  templateId: string;
  status: ObservationStatusInput;
  title: string | null;
  description: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  observationDate: Date | string | null;
  dueAt: string | null;
  reopenedAt: Date | string | null;
  submittedAt: Date | string | null;
  acknowledgedAt: Date | string | null;
  scopeType: "INDIVIDUAL" | "CLASS" | "SUBJECT";
  className: string | null;
  subjectName: string | null;
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

interface ParticipantRow {
  id: string;
  email: string;
  fullName: string | null;
  departmentId: string | null;
  departmentName: string | null;
  acknowledgedAt: Date | string | null;
  acknowledgementMethod: ObservationAcknowledgementMethod | null;
  acknowledgementResponse: string | null;
  acknowledgementNote: string | null;
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
  affectedStaffId: string | null;
  affectedStaffEmail: string | null;
  affectedStaffName: string | null;
  affectedDepartmentId: string | null;
  affectedDepartmentName: string | null;
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

function aggregateObservationStatus(
  status: ObservationStatusInput,
  acknowledgedCount: number,
  participantCount: number,
): ObservationStatus {
  const normalized = normalizeObservationStatus(status);
  if (normalized === "draft") return "draft";
  return participantCount > 0 && acknowledgedCount === participantCount
    ? "acknowledged"
    : "submitted";
}

function safeAuditNotes(
  eventType: string,
  notes: string | null,
  affectedStaffId: string | null,
): string | null {
  if (!affectedStaffId && !eventType.toLowerCase().includes("acknowledg")) {
    return notes;
  }
  if (eventType === "participant_added") {
    return "Participant added to the observation draft.";
  }
  if (eventType === "participant_removed") {
    return "Participant removed from the observation draft.";
  }
  if (eventType === "all_participants_acknowledged") {
    return "All observation participants have acknowledged.";
  }
  return "Participant acknowledgement recorded.";
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
  managerId: string | null;
  templateId: string;
  status: ObservationStatusInput;
  title: string | null;
  description: string | null;
  observationDate: Date | string | null;
  dueAt: string | null;
  scopeType: ObservationScopeType;
  className: string | null;
  subjectName: string | null;
  rubricName: string;
  managerEmail: string | null;
  managerName: string | null;
}

interface ManagerPatchRow {
  id: string;
  email: string;
  fullName: string | null;
  departmentId: string | null;
  eligible: boolean;
  isAdmin: boolean;
}

interface PatchParticipantRow {
  id: string;
  email: string;
  fullName: string | null;
  departmentId?: string | null;
  isActive?: boolean;
  hasStaffRole?: boolean;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isRequestObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

const UPDATE_OBSERVATION_KEYS = new Set([
  "managerId",
  "staffIds",
  "title",
  "description",
  "observationDate",
  "dueAt",
  "scopeType",
  "className",
  "subjectName",
]);

function validateUpdateObservationBody(body: Record<string, unknown>): string | null {
  const unsupportedKey = Object.keys(body).find(
    (key) => !UPDATE_OBSERVATION_KEYS.has(key),
  );
  if (unsupportedKey) return `Unsupported field: ${unsupportedKey}.`;

  if (body.managerId !== undefined && typeof body.managerId !== "string") {
    return "managerId must be a valid UUID.";
  }
  if (body.staffIds !== undefined && !Array.isArray(body.staffIds)) {
    return "staffIds must contain between 1 and 20 staff IDs.";
  }
  for (const field of ["title", "description"] as const) {
    if (body[field] !== undefined && typeof body[field] !== "string") {
      return `${field} must be a string.`;
    }
  }
  for (const field of ["observationDate", "dueAt"] as const) {
    if (
      body[field] !== undefined &&
      body[field] !== null &&
      typeof body[field] !== "string"
    ) {
      return `${field} must be a string or null.`;
    }
  }
  if (
    body.scopeType !== undefined &&
    (typeof body.scopeType !== "string" ||
      !["INDIVIDUAL", "CLASS", "SUBJECT"].includes(body.scopeType))
  ) {
    return "scopeType must be INDIVIDUAL, CLASS, or SUBJECT.";
  }
  for (const field of ["className", "subjectName"] as const) {
    if (
      body[field] !== undefined &&
      body[field] !== null &&
      typeof body[field] !== "string"
    ) {
      return `${field} must be a string or null.`;
    }
  }
  return null;
}

function patchStaffIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) {
    throw new Error("staffIds must contain between 1 and 20 staff IDs.");
  }
  const staffIds = value.map((staffId) => {
    if (typeof staffId !== "string" || !UUID_PATTERN.test(staffId.trim())) {
      throw new Error("Every staff ID must be a valid UUID.");
    }
    return staffId.trim().toLowerCase();
  });
  if (new Set(staffIds).size !== staffIds.length) {
    throw new Error("Duplicate staff IDs are not allowed.");
  }
  return staffIds;
}

function patchScope(
  body: UpdateObservationInput,
  current: Pick<ObservationPatchRow, "scopeType" | "className" | "subjectName">,
  participantCount: number,
) {
  const scopeType = body.scopeType ?? current.scopeType;
  if (!(["INDIVIDUAL", "CLASS", "SUBJECT"] as string[]).includes(scopeType)) {
    throw new Error("scopeType must be INDIVIDUAL, CLASS, or SUBJECT.");
  }
  const className = body.className !== undefined
    ? patchText(body.className, 200)
    : current.className;
  const subjectName = body.subjectName !== undefined
    ? patchText(body.subjectName, 200)
    : current.subjectName;
  if (participantCount > 1 && scopeType === "INDIVIDUAL") {
    throw new Error("Multi-teacher observations must use CLASS or SUBJECT scope.");
  }
  if (scopeType === "CLASS" && !className) {
    throw new Error("Class name is required for class scope.");
  }
  if (scopeType === "SUBJECT" && !subjectName) {
    throw new Error("Subject name is required for subject scope.");
  }
  return { scopeType, className, subjectName };
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
    const parsedBody: unknown = await request.json().catch(() => ({}));
    if (!isRequestObject(parsedBody)) {
      return NextResponse.json(
        { error: "Request body must be a JSON object." },
        { status: 400 },
      );
    }
    const validationError = validateUpdateObservationBody(parsedBody);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }
    const body = parsedBody as UpdateObservationInput;
    const keys = Object.keys(body);
    if (keys.length === 0) {
      return NextResponse.json(
        { error: "No supported fields were provided." },
        { status: 400 },
      );
    }
    if (body.managerId !== undefined && !isAdmin) {
      return NextResponse.json(
        { error: "Only administrators can reassign observers." },
        { status: 403 },
      );
    }

    const requestedStaffIds = body.staffIds !== undefined
      ? patchStaffIds(body.staffIds)
      : null;
    const client = await pool.connect();
    let observation!: ObservationPatchRow;
    let participants: PatchParticipantRow[] = [];
    let newManager: ManagerPatchRow | null = null;
    let reassigned = false;

    try {
      await client.query("BEGIN");
      const observationResult = await client.query<ObservationPatchRow>(
        `SELECT
           o.id, o."managerId", o.template_id AS "templateId", o.status,
           o.title, o.description, o.observation_date AS "observationDate",
           o.due_at::date::text AS "dueAt",
           COALESCE(o.scope_type, 'INDIVIDUAL')::text AS "scopeType",
           o.class_name AS "className", o.subject_name AS "subjectName",
           rt.name AS "rubricName", mu.email AS "managerEmail",
           mp.full_name AS "managerName"
         FROM observations o
         JOIN rubric_templates rt ON rt.id = o.template_id
         LEFT JOIN users mu ON mu.id = o."managerId"
         LEFT JOIN profiles mp ON mp.user_id = mu.id
         WHERE o.id = $1
         FOR UPDATE OF o`,
        [id],
      );
      observation = observationResult.rows[0];
      if (!observation) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: "Observation not found." },
          { status: 404 },
        );
      }
      if (!isAdmin && observation.managerId !== session.user.id) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: "Only the assigned observer can edit this observation." },
          { status: 403 },
        );
      }

      const currentParticipantsResult = await client.query<PatchParticipantRow>(
        `SELECT
           u.id, u.email, p.full_name AS "fullName",
           p.department_id AS "departmentId"
         FROM observation_participants op
         JOIN users u ON u.id = op.staff_id
         LEFT JOIN profiles p ON p.user_id = u.id
         WHERE op.observation_id = $1
         ORDER BY LOWER(COALESCE(NULLIF(BTRIM(p.full_name), ''), u.email)), LOWER(u.email), u.id
         FOR UPDATE OF op`,
        [id],
      );
      const currentParticipants = currentParticipantsResult.rows;
      if (currentParticipants.length === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: "Observation has no participants." },
          { status: 409 },
        );
      }

      const hasDraftOnlyChanges = keys.some((key) => key !== "managerId");
      if (hasDraftOnlyChanges && observation.status !== "draft") {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: "Participants, scope, and metadata can only be changed while the observation is a draft." },
          { status: 400 },
        );
      }

      let managerId = observation.managerId;
      if (body.managerId !== undefined) {
        managerId = body.managerId.trim();
        if (!managerId || !UUID_PATTERN.test(managerId)) {
          await client.query("ROLLBACK");
          return NextResponse.json(
            { error: "managerId must be a valid UUID." },
            { status: 400 },
          );
        }
      }

      const staffIds = requestedStaffIds ?? currentParticipants.map(({ id }) => id);
      if (staffIds.includes(managerId ?? "")) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: "The assigned observer cannot be an observation participant." },
          { status: 400 },
        );
      }

      if (requestedStaffIds) {
        const participantResult = await client.query<PatchParticipantRow>(
          `SELECT
             u.id, u.email, p.full_name AS "fullName",
             p.department_id AS "departmentId",
             u.status = 'active' AS "isActive",
             COALESCE(bool_or(ur.role = 'staff'), false) AS "hasStaffRole"
           FROM users u
           LEFT JOIN profiles p ON p.user_id = u.id
           LEFT JOIN user_roles ur ON ur.user_id = u.id
           WHERE u.id = ANY($1::uuid[])
           GROUP BY u.id, u.email, u.status, p.full_name, p.department_id
           ORDER BY LOWER(COALESCE(NULLIF(BTRIM(p.full_name), ''), u.email)), LOWER(u.email), u.id`,
          [staffIds],
        );
        participants = participantResult.rows;
        if (
          participants.length !== staffIds.length ||
          participants.some((participant) => !participant.isActive)
        ) {
          await client.query("ROLLBACK");
          return NextResponse.json(
            { error: "Every selected participant must exist and be active." },
            { status: 400 },
          );
        }
        if (participants.some((participant) => !participant.hasStaffRole)) {
          await client.query("ROLLBACK");
          return NextResponse.json(
            { error: "Every selected participant must have the staff role." },
            { status: 400 },
          );
        }

        const rubricAssignment = await client.query<{ assigned: boolean }>(
          `WITH selected_staff AS (
             SELECT UNNEST($1::uuid[]) AS staff_id
           ), eligible_staff AS (
             SELECT DISTINCT selected.staff_id
             FROM selected_staff selected
             JOIN profiles sp ON sp.user_id = selected.staff_id
             JOIN user_roles sur ON sur.user_id = selected.staff_id
             JOIN department_roles dr
               ON dr.role = sur.role
              AND (dr.department_id = sp.department_id OR dr.department_id IS NULL)
             JOIN role_workflow_assignments rwa
               ON rwa.department_role_id = dr.id AND rwa.is_active = true
             JOIN rubric_templates rt
               ON rt.id = rwa.rubric_id
              AND rt.is_active = true
              AND rt.template_type IN ('CLASSROOM_OBSERVATION', 'GENERIC')
             JOIN workflow_definitions wd
               ON wd.id = rwa.workflow_id AND wd.type = 'CLASSROOM_OBSERVATION'
             WHERE rt.id = $2
           )
           SELECT COUNT(DISTINCT staff_id) = CARDINALITY($1::uuid[]) AS assigned
           FROM eligible_staff`,
          [staffIds, observation.templateId],
        );
        if (!rubricAssignment.rows[0]?.assigned) {
          await client.query("ROLLBACK");
          return NextResponse.json(
            { error: "The current observation form must remain assigned to every selected participant's active role." },
            { status: 403 },
          );
        }
      } else {
        participants = currentParticipants;
      }

      const managerResult = managerId
        ? await client.query<ManagerPatchRow>(
            `SELECT
               u.id, u.email, p.full_name AS "fullName",
               p.department_id AS "departmentId",
               COALESCE(bool_or(ur.role IN ('manager', 'admin')), false) AS eligible,
               COALESCE(bool_or(ur.role = 'admin'), false) AS "isAdmin"
             FROM users u
             LEFT JOIN profiles p ON p.user_id = u.id
             LEFT JOIN user_roles ur ON ur.user_id = u.id
             WHERE u.id = $1 AND u.status = 'active'
             GROUP BY u.id, u.email, p.full_name, p.department_id`,
            [managerId],
          )
        : null;
      const resultingManager = managerResult?.rows[0] ?? null;
      if (!resultingManager?.eligible) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: "The observer must be an active manager or administrator." },
          { status: 400 },
        );
      }
      if (
        !resultingManager.isAdmin &&
        (!resultingManager.departmentId ||
          participants.some(
            (participant) =>
              !participant.departmentId ||
              participant.departmentId !== resultingManager.departmentId,
          ))
      ) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: "Managers can only observe participants in their department." },
          { status: 403 },
        );
      }
      if (body.managerId !== undefined) newManager = resultingManager;

      const scope = patchScope(body, observation, staffIds.length);
      const title = body.title !== undefined
        ? patchText(body.title, 200)
        : observation.title;
      const description = body.description !== undefined
        ? patchText(body.description, 2000)
        : observation.description;
      const observationDate = body.observationDate !== undefined
        ? patchDate(body.observationDate, "Observation date")
        : observation.observationDate
          ? new Date(observation.observationDate)
          : null;
      const dueAt = body.dueAt !== undefined
        ? normalizeDateOnly(body.dueAt, "Due date")
        : observation.dueAt;
      if (
        observationDate &&
        dueAt &&
        dueAt < observationDate.toISOString().slice(0, 10)
      ) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: "Due date cannot precede the observation date." },
          { status: 400 },
        );
      }

      const currentIds = new Set(currentParticipants.map(({ id: staffId }) => staffId));
      const nextIds = new Set(staffIds);
      const addedIds = staffIds.filter((staffId) => !currentIds.has(staffId));
      const removedIds = currentParticipants
        .map(({ id: staffId }) => staffId)
        .filter((staffId) => !nextIds.has(staffId));
      const legacyStaffId = [...staffIds].sort()[0];
      reassigned = managerId !== observation.managerId;

      if (addedIds.length > 0) {
        await client.query(
          `INSERT INTO observation_participants
             (id, observation_id, staff_id, created_at, updated_at)
           SELECT gen_random_uuid(), $1, selected.staff_id, NOW(), NOW()
           FROM UNNEST($2::uuid[]) AS selected(staff_id)`,
          [id, addedIds],
        );
      }
      if (removedIds.length > 0) {
        await client.query(
          `DELETE FROM observation_participants
           WHERE observation_id = $1 AND staff_id = ANY($2::uuid[])`,
          [id, removedIds],
        );
      }
      await client.query(
        `UPDATE observations
         SET "staffId" = $2, "managerId" = $3, title = $4, description = $5,
             observation_date = $6, due_at = $7::date, scope_type = $8,
             class_name = $9, subject_name = $10, updated_at = NOW()
         WHERE id = $1`,
        [
          id,
          legacyStaffId,
          managerId,
          title,
          description,
          observationDate,
          dueAt,
          scope.scopeType,
          scope.className,
          scope.subjectName,
        ],
      );

      for (const staffId of addedIds) {
        await client.query(
          `INSERT INTO observation_updates
             (id, observation_id, updated_by_id, staff_id, status_from,
              status_to, event_type, notes, created_at)
           VALUES ($1, $2, $3, $4, 'draft', 'draft',
                   'participant_added', 'Participant added to draft', NOW())`,
          [randomUUID(), id, session.user.id, staffId],
        );
      }
      for (const staffId of removedIds) {
        await client.query(
          `INSERT INTO observation_updates
             (id, observation_id, updated_by_id, staff_id, status_from,
              status_to, event_type, notes, created_at)
           VALUES ($1, $2, $3, $4, 'draft', 'draft',
                   'participant_removed', 'Participant removed from draft', NOW())`,
          [randomUUID(), id, session.user.id, staffId],
        );
      }
      if (reassigned) {
        await client.query(
          `INSERT INTO observation_updates
             (id, observation_id, updated_by_id, status_from, status_to,
              event_type, notes, created_at)
           VALUES ($1, $2, $3, $4, $4, 'reassigned', $5, NOW())`,
          [
            randomUUID(),
            id,
            session.user.id,
            normalizeObservationStatus(observation.status),
            `Observer reassigned from ${observation.managerName ?? observation.managerEmail ?? "Unassigned"} to ${newManager?.fullName ?? newManager?.email ?? "Unassigned"}`,
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
      const participantLabel = participants.length === 1
        ? participants[0].fullName ?? participants[0].email
        : `${participants.length} participants`;
      await Promise.all([
        observation.managerEmail
          ? notifyObservationReassigned(
              observation.managerId!,
              observation.managerEmail,
              observation.managerName ?? observation.managerEmail,
              participantLabel,
              observation.rubricName,
              id,
              false,
            ).catch((error: unknown) =>
              console.error("Old manager notification error:", error),
            )
          : Promise.resolve(),
        notifyObservationReassigned(
          newManager.id,
          newManager.email,
          newManager.fullName ?? newManager.email,
          participantLabel,
          observation.rubricName,
          id,
          true,
        ).catch((error: unknown) =>
          console.error("New manager notification error:", error),
        ),
      ]);
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("PATCH /api/observations/[id] error:", error);
    const status =
      message.includes("characters or fewer") ||
      message.includes("is invalid") ||
      message.includes("staffIds") ||
      message.includes("staff ID") ||
      message.includes("Duplicate") ||
      message.includes("scope") ||
      message.includes("required")
        ? 400
        : 500;
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
      acknowledgedCount: number;
      participantCount: number;
    }>(
      `SELECT
         o."managerId",
         o.status,
         COUNT(op.id)::int AS "participantCount",
         COUNT(op.id) FILTER (WHERE op.acknowledged_at IS NOT NULL)::int AS "acknowledgedCount"
       FROM observations o
       LEFT JOIN observation_participants op ON op.observation_id = o.id
       WHERE o.id = $1
       GROUP BY o.id, o."managerId", o.status`,
      [id],
    );

    if (!observation) {
      return NextResponse.json({ error: "Observation not found." }, { status: 404 });
    }
    if (
      aggregateObservationStatus(
        observation.status,
        observation.acknowledgedCount,
        observation.participantCount,
      ) === "acknowledged"
    ) {
      return NextResponse.json(
        { error: "Completed observations cannot be deleted." },
        { status: 409 },
      );
    }
    if (!isAdmin && observation.managerId !== session.user.id) {
      return NextResponse.json(
        { error: "Only an administrator or the assigned observer can delete this observation." },
        { status: 403 },
      );
    }

    const deleted = await queryOne<{ id: string }>(
      `DELETE FROM observations
       WHERE id = $1
         AND status IN ('draft', 'pending', 'submitted', 'reviewed')
         AND NOT (
           status NOT IN ('draft', 'pending')
           AND EXISTS (
             SELECT 1
             FROM observation_participants delete_participant
             WHERE delete_participant.observation_id = observations.id
           )
           AND NOT EXISTS (
             SELECT 1
             FROM observation_participants pending_participant
             WHERE pending_participant.observation_id = observations.id
               AND pending_participant.acknowledged_at IS NULL
           )
         )
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
         o."managerId",
         o.template_id     AS "templateId",
         o.status,
         o.title,
         o.description,
         o.created_at      AS "createdAt",
         o.updated_at      AS "updatedAt",
         o.observation_date AS "observationDate",
         o.due_at::date::text AS "dueAt",
         o.reopened_at     AS "reopenedAt",
         o.submitted_at    AS "submittedAt",
         o.acknowledged_at AS "acknowledgedAt",
         COALESCE(o.scope_type, 'INDIVIDUAL')::text AS "scopeType",
         o.class_name AS "className",
         o.subject_name AS "subjectName",
         mu.email          AS "managerEmail",
         mp.full_name      AS "managerName"
       FROM observations o
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

    const participantRows = await query<ParticipantRow>(
      `SELECT
         u.id,
         u.email,
         p.full_name AS "fullName",
         p.department_id AS "departmentId",
         d.name AS "departmentName",
         op.acknowledged_at AS "acknowledgedAt",
         op.acknowledgement_method AS "acknowledgementMethod",
         op.acknowledgement_response AS "acknowledgementResponse",
         op.acknowledgement_note AS "acknowledgementNote"
       FROM observation_participants op
       JOIN users u ON u.id = op.staff_id
       LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN departments d ON d.id = p.department_id
       WHERE op.observation_id = $1
       ORDER BY LOWER(COALESCE(NULLIF(BTRIM(p.full_name), ''), u.email)), LOWER(u.email), u.id`,
      [id],
    );
    if (participantRows.length === 0) {
      return NextResponse.json(
        { error: "Observation has no participants." },
        { status: 409 },
      );
    }

    const actorParticipant = participantRows.find(
      (participant) => participant.id === user.id,
    );
    const acknowledgedCount = participantRows.filter(
      (participant) => participant.acknowledgedAt !== null,
    ).length;
    const status = aggregateObservationStatus(
      observation.status,
      acknowledgedCount,
      participantRows.length,
    );
    const permissions = getObservationPermissions(user, {
      status,
      managerId: observation.managerId ? String(observation.managerId) : null,
      isParticipant: Boolean(actorParticipant),
      participantAcknowledgedAt: actorParticipant?.acknowledgedAt ?? null,
      participantAcknowledgementMethod:
        actorParticipant?.acknowledgementMethod ?? null,
      staffId: String(participantRows[0].id),
    });

    if (!permissions.canViewRecord)
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });

    const canViewAllAcknowledgementResponses =
      user.roles.includes("admin") ||
      user.roles.includes("director") ||
      observation.managerId === user.id;
    const participants: ObservationParticipantDetail[] = participantRows.map((participant) => {
      const acknowledgementResponseVisible =
        canViewAllAcknowledgementResponses || participant.id === user.id;
      return {
        id: participant.id,
        email: participant.email,
        fullName: participant.fullName,
        department:
          participant.departmentId && participant.departmentName
            ? { id: participant.departmentId, name: participant.departmentName }
            : null,
        acknowledgedAt: serializeNullableDate(participant.acknowledgedAt),
        acknowledgementMethod: participant.acknowledgementMethod,
        acknowledgementResponse: acknowledgementResponseVisible
          ? participant.acknowledgementResponse
          : null,
        acknowledgementNote: acknowledgementResponseVisible
          ? participant.acknowledgementNote
          : null,
        acknowledgementResponseVisible,
      };
    });
    const firstParticipant = participants[0];
    const acknowledgementProgress = {
      acknowledged: acknowledgedCount,
      total: participants.length,
      pending: participants.length - acknowledgedCount,
      percentage: Math.round((acknowledgedCount / participants.length) * 100),
    };

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
         p.full_name     AS "updaterName",
         affected.id     AS "affectedStaffId",
         affected.email  AS "affectedStaffEmail",
         affected_profile.full_name AS "affectedStaffName",
         affected_profile.department_id AS "affectedDepartmentId",
         affected_department.name AS "affectedDepartmentName"
       FROM observation_updates ou
       LEFT JOIN users u    ON u.id = ou.updated_by_id
       LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN users affected ON affected.id = ou.staff_id
       LEFT JOIN profiles affected_profile ON affected_profile.user_id = affected.id
       LEFT JOIN departments affected_department
         ON affected_department.id = affected_profile.department_id
       WHERE ou.observation_id = $1
       ORDER BY ou.created_at ASC`,
      [id],
    );

    const auditTrail = auditRows.map((row) => ({
      id: row.id,
      eventType: row.eventType,
      statusFrom: row.statusFrom ? observationStatus(row.statusFrom) : null,
      statusTo: observationStatus(row.statusTo),
      notes: safeAuditNotes(row.eventType, row.notes, row.affectedStaffId),
      createdAt: serializeDate(row.createdAt),
      updatedBy: row.updaterId
        ? {
            id: row.updaterId,
            email: row.updaterEmail ?? "",
            profile: { fullName: row.updaterName },
          }
        : null,
      affectedParticipant: row.affectedStaffId
        ? {
            id: row.affectedStaffId,
            email: row.affectedStaffEmail ?? "",
            fullName: row.affectedStaffName,
            department:
              row.affectedDepartmentId && row.affectedDepartmentName
                ? {
                    id: row.affectedDepartmentId,
                    name: row.affectedDepartmentName,
                  }
                : null,
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
        affectedParticipant: null,
      });
    }

    const observationDetail: ObservationDetail = {
      id: String(observation.id),
      staffId: String(firstParticipant.id),
      managerId: observation.managerId ? String(observation.managerId) : null,
      templateId: String(observation.templateId),
      status,
      title: observation.title,
      description: observation.description,
      createdAt: serializeDate(observation.createdAt),
      updatedAt: serializeDate(observation.updatedAt),
      observationDate: serializeNullableDate(observation.observationDate),
      dueAt: dateOnlyToIso(observation.dueAt),
      reopenedAt: serializeNullableDate(observation.reopenedAt),
      submittedAt: serializeNullableDate(observation.submittedAt),
      acknowledgedAt:
        status === "acknowledged"
          ? serializeNullableDate(observation.acknowledgedAt) ??
            firstParticipant.acknowledgedAt
          : null,
      acknowledgementResponse: firstParticipant.acknowledgementResponse,
      acknowledgementMethod: firstParticipant.acknowledgementMethod,
      acknowledgementNote: firstParticipant.acknowledgementNote,
      staff: {
        id: firstParticipant.id,
        email: firstParticipant.email,
        profile: {
          fullName: firstParticipant.fullName,
          department: firstParticipant.department,
        },
      },
      participants,
      scope: {
        type: observation.scopeType,
        className: observation.className,
        subjectName: observation.subjectName,
      },
      acknowledgementProgress,
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
