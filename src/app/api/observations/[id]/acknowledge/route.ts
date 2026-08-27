import { randomUUID } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { getObservationSession } from "@/features/observations/server/auth";
import { pool, query, queryOne } from "@/lib/db";
import { getObservationPermissions } from "@/features/observations/server/permissions";
import {
  notifyObservationAcknowledged,
  notifyManagerObservationAcknowledged,
} from "@/lib/notifications/observation-notifications";
import type { ObservationStatus } from "@/features/observations/types";

type AcknowledgementMethod = "personal" | "automatic";

interface AcknowledgeObservationRow {
  id: string;
  legacyStaffId: string;
  managerId: string | null;
  status: ObservationStatus;
  acknowledgedAt: Date | string | null;
  participantId: string | null;
  participantStaffId: string | null;
  participantAcknowledgedAt: Date | string | null;
  participantAcknowledgementResponse: string | null;
  participantAcknowledgementMethod: AcknowledgementMethod | null;
  participantAcknowledgementNote: string | null;
  participantEmail: string | null;
  participantName: string | null;
  managerEmail: string | null;
  managerName: string | null;
  rubricName: string | null;
  title: string | null;
}

interface LockedObservationRow {
  status: ObservationStatus;
  acknowledgedAt: Date | string | null;
}

interface LockedParticipantRow {
  id: string;
  staffId: string;
  acknowledgedAt: Date | string | null;
  acknowledgementMethod: AcknowledgementMethod | null;
  acknowledgementResponse: string | null;
  acknowledgementNote: string | null;
}

interface AcknowledgementResult {
  status: ObservationStatus;
  acknowledgedAt: Date | string | null;
  participantAcknowledgedAt: Date | string;
  acknowledgementResponse: string | null;
  remainingParticipants: number;
  updated: boolean;
}

interface AdminEmailRow {
  id: string;
  email: string;
}

function serializeDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function accessRecord(
  observation: Pick<
    AcknowledgeObservationRow,
    | "status"
    | "managerId"
    | "participantId"
    | "participantAcknowledgedAt"
    | "participantAcknowledgementMethod"
  >,
) {
  return {
    status: observation.status,
    managerId: observation.managerId,
    isParticipant: Boolean(observation.participantId),
    participantAcknowledgedAt: observation.participantAcknowledgedAt,
    participantAcknowledgementMethod:
      observation.participantAcknowledgementMethod,
  };
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

    const userId = session.user.id as string;
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      response?: unknown;
    };
    const acknowledgementResponse =
      typeof body.response === "string" ? body.response.trim() : "";

    const observation = await queryOne<AcknowledgeObservationRow>(
      `SELECT
         o.id,
         o."staffId" AS "legacyStaffId",
         o."managerId",
         o.status,
         o.acknowledged_at AS "acknowledgedAt",
         op.id AS "participantId",
         op.staff_id AS "participantStaffId",
         op.acknowledged_at AS "participantAcknowledgedAt",
         op.acknowledgement_response AS "participantAcknowledgementResponse",
         op.acknowledgement_method AS "participantAcknowledgementMethod",
         op.acknowledgement_note AS "participantAcknowledgementNote",
         pu.email AS "participantEmail",
         pp.full_name AS "participantName",
         mu.email AS "managerEmail",
         mp.full_name AS "managerName",
         rt.name AS "rubricName",
         o.title
       FROM observations o
       LEFT JOIN observation_participants op
         ON op.observation_id = o.id AND op.staff_id = $2
       LEFT JOIN users pu ON pu.id = op.staff_id
       LEFT JOIN profiles pp ON pp.user_id = pu.id
       LEFT JOIN users mu ON mu.id = o."managerId"
       LEFT JOIN profiles mp ON mp.user_id = mu.id
       LEFT JOIN rubric_templates rt ON rt.id = o.template_id
       WHERE o.id = $1`,
      [id, userId],
    );

    if (!observation) {
      return NextResponse.json(
        { error: "Observation not found." },
        { status: 404 },
      );
    }

    const roles = ((session.user as { roles?: string[] }).roles ?? []) as string[];
    const permissions = getObservationPermissions(
      { id: userId, roles },
      accessRecord(observation),
    );

    if (
      observation.participantId &&
      observation.participantAcknowledgementMethod === "personal"
    ) {
      return NextResponse.json({
        id: observation.id,
        status: observation.status,
        acknowledgedAt: observation.acknowledgedAt
          ? serializeDate(observation.acknowledgedAt)
          : null,
        staffId: observation.participantStaffId,
        managerId: observation.managerId,
        acknowledgementResponse:
          observation.participantAcknowledgementResponse,
        acknowledgementMethod:
          observation.participantAcknowledgementMethod,
        acknowledgementNote: observation.participantAcknowledgementNote,
      });
    }

    const canReplaceAutomaticAcknowledgement =
      Boolean(observation.participantId) &&
      observation.participantAcknowledgementMethod === "automatic" &&
      (observation.status === "submitted" ||
        observation.status === "acknowledged");

    if (!permissions.canAcknowledge && !canReplaceAutomaticAcknowledgement) {
      const isSubmitted = observation.status === "submitted";
      return NextResponse.json(
        {
          error: isSubmitted
            ? "Forbidden: only a pending observation participant can acknowledge this observation."
            : `Observation must be submitted to acknowledge. Current: ${observation.status}`,
        },
        { status: isSubmitted ? 403 : 400 },
      );
    }

    if (acknowledgementResponse.length < 10) {
      return NextResponse.json(
        { error: "Acknowledgement response must be at least 10 characters." },
        { status: 400 },
      );
    }
    if (acknowledgementResponse.length > 2000) {
      return NextResponse.json(
        { error: "Acknowledgement response must be 2000 characters or fewer." },
        { status: 400 },
      );
    }

    const client = await pool.connect();
    let result: AcknowledgementResult;
    try {
      await client.query("BEGIN");

      const parentResult = await client.query<LockedObservationRow>(
        `SELECT status, acknowledged_at AS "acknowledgedAt"
         FROM observations
         WHERE id = $1
         FOR UPDATE`,
        [id],
      );
      const parent = parentResult.rows[0];
      if (!parent) {
        const error = new Error("Observation not found.");
        error.name = "OBSERVATION_NOT_FOUND";
        throw error;
      }

      const participantResult = await client.query<LockedParticipantRow>(
        `SELECT
           id,
           staff_id AS "staffId",
           acknowledged_at AS "acknowledgedAt",
           acknowledgement_method AS "acknowledgementMethod",
           acknowledgement_response AS "acknowledgementResponse",
           acknowledgement_note AS "acknowledgementNote"
         FROM observation_participants
         WHERE observation_id = $1 AND staff_id = $2
         FOR UPDATE`,
        [id, userId],
      );
      const participant = participantResult.rows[0];
      if (!participant) {
        const error = new Error(
          "Forbidden: only an observation participant can acknowledge this observation.",
        );
        error.name = "OBSERVATION_ACKNOWLEDGEMENT_FORBIDDEN";
        throw error;
      }

      if (participant.acknowledgementMethod === "personal") {
        const pendingResult = await client.query<{ count: number }>(
          `SELECT COUNT(*)::int AS count
           FROM observation_participants
           WHERE observation_id = $1 AND acknowledged_at IS NULL`,
          [id],
        );
        await client.query("COMMIT");
        result = {
          status: parent.status,
          acknowledgedAt: parent.acknowledgedAt,
          participantAcknowledgedAt: participant.acknowledgedAt!,
          acknowledgementResponse: participant.acknowledgementResponse,
          remainingParticipants: pendingResult.rows[0]?.count ?? 0,
          updated: false,
        };
      } else {
        const canPersonallyAcknowledge =
          parent.status === "submitted" ||
          (parent.status === "acknowledged" &&
            participant.acknowledgementMethod === "automatic");
        if (!canPersonallyAcknowledge) {
          const error = new Error(
            "Observation status changed before acknowledgement.",
          );
          error.name = "OBSERVATION_ACKNOWLEDGEMENT_CONFLICT";
          throw error;
        }

        const updateParticipant = await client.query<{
          acknowledgedAt: Date | string;
        }>(
          `UPDATE observation_participants
           SET acknowledged_at = NOW(),
               acknowledgement_response = $3,
               acknowledgement_method = 'personal',
               acknowledgement_note = NULL,
               updated_at = NOW()
           WHERE id = $1 AND observation_id = $2
           RETURNING acknowledged_at AS "acknowledgedAt"`,
          [participant.id, id, acknowledgementResponse],
        );
        const participantAcknowledgedAt =
          updateParticipant.rows[0]?.acknowledgedAt;
        if (!participantAcknowledgedAt) {
          throw new Error("Participant acknowledgement was not saved.");
        }

        const pendingResult = await client.query<{ count: number }>(
          `SELECT COUNT(*)::int AS count
           FROM observation_participants
           WHERE observation_id = $1 AND acknowledged_at IS NULL`,
          [id],
        );
        const remainingParticipants = pendingResult.rows[0]?.count ?? 0;
        const completed = remainingParticipants === 0;

        let acknowledgedAt: Date | string | null = null;
        if (completed) {
          const completedParent = await client.query<{
            acknowledgedAt: Date | string;
          }>(
            `UPDATE observations
             SET status = 'acknowledged',
                 acknowledged_at = COALESCE(acknowledged_at, NOW()),
                 acknowledgement_response = NULL,
                 acknowledgement_method = (
                   SELECT CASE
                     WHEN BOOL_AND(op.acknowledgement_method = 'automatic')
                       THEN 'automatic'
                     ELSE 'personal'
                   END
                   FROM observation_participants op
                   WHERE op.observation_id = observations.id
                 ),
                 acknowledgement_note = NULL,
                 updated_at = NOW()
             WHERE id = $1
             RETURNING acknowledged_at AS "acknowledgedAt"`,
            [id],
          );
          acknowledgedAt = completedParent.rows[0]?.acknowledgedAt ?? null;
        } else if (parent.status === "acknowledged") {
          throw new Error(
            "Acknowledged observation has pending participant acknowledgements.",
          );
        }

        await client.query(
          `INSERT INTO observation_updates
             (id, observation_id, updated_by_id, staff_id, status_from, status_to,
              event_type, notes, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, 'participant_acknowledged', $7, NOW())`,
          [
            randomUUID(),
            id,
            userId,
            participant.staffId,
            parent.status,
            completed ? "acknowledged" : "submitted",
            "Participant personally acknowledged the observation.",
          ],
        );

        if (completed && parent.status !== "acknowledged") {
          await client.query(
            `INSERT INTO observation_updates
               (id, observation_id, updated_by_id, status_from, status_to,
                event_type, notes, created_at)
             VALUES ($1, $2, $3, $4, 'acknowledged',
                     'all_participants_acknowledged', $5, NOW())`,
            [
              randomUUID(),
              id,
              userId,
              parent.status,
              "All observation participants have acknowledged.",
            ],
          );
        }

        await client.query("COMMIT");
        result = {
          status: completed ? "acknowledged" : "submitted",
          acknowledgedAt,
          participantAcknowledgedAt,
          acknowledgementResponse,
          remainingParticipants,
          updated: true,
        };
      }
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    const participantName =
      observation.participantName ?? observation.participantEmail ?? "Participant";
    const managerName =
      observation.managerName ?? observation.managerEmail ?? "Observer";
    const observationTitle =
      observation.title?.trim() || observation.rubricName || "Observation";

    if (result.updated && observation.managerId && observation.managerEmail) {
      await notifyManagerObservationAcknowledged(
        observation.managerId,
        observation.managerEmail,
        participantName,
        managerName,
        observationTitle,
        id,
        undefined,
        undefined,
        { remaining: result.remainingParticipants },
      ).catch((err: unknown) =>
        console.error("[acknowledge] manager notify error:", err),
      );
    }

    const adminUsers = result.updated
      ? await query<AdminEmailRow>(
          `SELECT u.id, u.email FROM users u
           JOIN user_roles ur ON ur.user_id = u.id
           WHERE ur.role = 'admin' AND u.status = 'active'
           LIMIT 3`,
        )
      : [];

    for (const adminUser of adminUsers) {
      if (adminUser.email && adminUser.email !== observation.managerEmail) {
        await notifyObservationAcknowledged(
          adminUser.id,
          adminUser.email,
          participantName,
          managerName,
          observationTitle,
          id,
        ).catch((err: unknown) =>
          console.error("[acknowledge] admin notify error:", err),
        );
      }
    }

    return NextResponse.json({
      id: observation.id,
      status: result.status,
      acknowledgedAt: result.acknowledgedAt
        ? serializeDate(result.acknowledgedAt)
        : null,
      staffId: observation.participantStaffId,
      managerId: observation.managerId,
      participantAcknowledgedAt: serializeDate(result.participantAcknowledgedAt),
      acknowledgementResponse: result.acknowledgementResponse,
      acknowledgementMethod: "personal",
      acknowledgementNote: null,
      remainingParticipants: result.remainingParticipants,
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === "OBSERVATION_NOT_FOUND") {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.name === "OBSERVATION_ACKNOWLEDGEMENT_FORBIDDEN") {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.name === "OBSERVATION_ACKNOWLEDGEMENT_CONFLICT") {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error("PATCH /api/observations/[id]/acknowledge error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
