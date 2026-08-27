import { randomUUID } from "crypto";
import { type NextRequest, NextResponse } from "next/server";
import { getObservationSession } from "@/features/observations/server/auth";
import { pool, queryOne } from "@/lib/db";
import { assertObservationTransition } from "@/features/observations/server/lifecycle";
import { getObservationPermissions } from "@/features/observations/server/permissions";
import { observationReopenSchema } from "@/features/observations/schemas";
import type { ObservationStatus } from "@/features/observations/types";
import { notifyManagerObservationReopened } from "@/lib/notifications/observation-notifications";

interface ReopenObservationRow {
  id: string;
  legacyStaffId: string;
  managerId: string | null;
  status: ObservationStatus;
  isParticipant: boolean;
  participantAcknowledgedAt: Date | string | null;
  participantAcknowledgementMethod: "personal" | "automatic" | null;
  managerEmail: string | null;
  managerName: string | null;
  rubricName: string | null;
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

    const parsedBody = observationReopenSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: parsedBody.error.issues[0]?.message ?? "Invalid reopen reason." },
        { status: 400 },
      );
    }

    const user = {
      id: session.user.id as string,
      roles: ((session.user as { roles?: string[] }).roles ?? []) as string[],
    };
    const { id } = await params;
    const observation = await queryOne<ReopenObservationRow>(
      `SELECT
         o.id,
         o."staffId" AS "legacyStaffId",
         o."managerId",
         o.status,
         EXISTS (
           SELECT 1 FROM observation_participants actor_op
           WHERE actor_op.observation_id = o.id AND actor_op.staff_id = $2
         ) AS "isParticipant",
         actor_op.acknowledged_at AS "participantAcknowledgedAt",
         actor_op.acknowledgement_method AS "participantAcknowledgementMethod",
         mu.email AS "managerEmail",
         mp.full_name AS "managerName",
         rt.name AS "rubricName"
       FROM observations o
       LEFT JOIN observation_participants actor_op
         ON actor_op.observation_id = o.id AND actor_op.staff_id = $2
       LEFT JOIN users mu ON mu.id = o."managerId"
       LEFT JOIN profiles mp ON mp.user_id = mu.id
       LEFT JOIN rubric_templates rt ON rt.id = o.template_id
       WHERE o.id = $1`,
      [id, user.id],
    );

    if (!observation) {
      return NextResponse.json(
        { error: "Observation not found." },
        { status: 404 },
      );
    }

    const access = {
      status: observation.status,
      managerId: observation.managerId,
      isParticipant: observation.isParticipant,
      participantAcknowledgedAt: observation.participantAcknowledgedAt,
      participantAcknowledgementMethod:
        observation.participantAcknowledgementMethod,
    };
    const permissions = getObservationPermissions(user, access);
    if (!permissions.canReopen) {
      return NextResponse.json(
        { error: "Only admins can reopen submitted or completed observations." },
        { status: 403 },
      );
    }

    assertObservationTransition(observation.status, "draft");

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const updateResult = await client.query(
        `UPDATE observations
         SET status = 'draft',
             reopened_at = NOW(),
             submitted_at = NULL,
             acknowledged_at = NULL,
             acknowledgement_response = NULL,
             acknowledgement_method = NULL,
             acknowledgement_note = NULL,
             acknowledgement_automation_started_at = NULL,
             updated_at = NOW()
         WHERE id = $1 AND status = $2
         RETURNING id`,
        [id, observation.status],
      );
      if (!updateResult.rows[0]) {
        throw new Error("Observation status changed before reopen.");
      }

      await client.query(
        `INSERT INTO observation_updates
           (id, observation_id, updated_by_id, staff_id, status_from, status_to,
            event_type, notes, created_at)
         SELECT
           gen_random_uuid(),
           op.observation_id,
           $2,
           op.staff_id,
           $3,
           'draft',
           'participant_acknowledgement_archived',
           CONCAT(
             'Archived participant acknowledgement before reopen: method=',
             COALESCE(op.acknowledgement_method, 'unknown'),
             ', acknowledged_at=',
             op.acknowledged_at::text
           ),
           NOW()
         FROM observation_participants op
         WHERE op.observation_id = $1 AND op.acknowledged_at IS NOT NULL`,
        [id, user.id, observation.status],
      );

      await client.query(
        `UPDATE observation_participants
         SET acknowledged_at = NULL,
             acknowledgement_response = NULL,
             acknowledgement_method = NULL,
             acknowledgement_note = NULL,
             acknowledgement_automation_started_at = NULL,
             updated_at = NOW()
         WHERE observation_id = $1`,
        [id],
      );

      await client.query(
        `INSERT INTO observation_updates
           (id, observation_id, updated_by_id, status_from, status_to, event_type, notes, created_at)
         VALUES ($1, $2, $3, $4, 'draft', 'reopened', $5, NOW())`,
        [
          randomUUID(),
          id,
          user.id,
          observation.status,
          parsedBody.data.reason,
        ],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    const rubricName = observation.rubricName ?? "Observation";
    const managerName =
      observation.managerName ?? observation.managerEmail ?? "Observer";
    const notifications: Promise<unknown>[] = [];

    if (observation.managerEmail) {
      notifications.push(
        notifyManagerObservationReopened(
          observation.managerId!,
          observation.managerEmail,
          managerName,
          "the observation participants",
          rubricName,
          parsedBody.data.reason,
          id,
        ),
      );
    }

    await Promise.allSettled(notifications).then((results) => {
      for (const result of results) {
        if (result.status === "rejected") {
          console.error("Reopen notification error:", result.reason);
        }
      }
    });

    return NextResponse.json({ id, status: "draft" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("PATCH /api/observations/[id]/reopen error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
