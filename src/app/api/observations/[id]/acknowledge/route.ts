// src/app/api/observations/[id]/acknowledge/route.ts
// Milestone 5: Staff Acknowledgement
//
// Acceptance criteria:
//   ✓ Staff cannot edit scores — they only acknowledge (read-only).
//   ✓ Staff can only acknowledge observations where they are the subject.
//   ✓ Status updates to acknowledged.
//   ✓ Audit trail records acknowledgement.
//   ✓ Observer and admin are notified.

import { type NextRequest, NextResponse } from "next/server";
import { getObservationSession } from "@/features/observations/server/auth";
import { pool, query, queryOne } from "@/lib/db";
import { getObservationPermissions } from "@/features/observations/server/permissions";
import { assertObservationTransition } from "@/features/observations/server/lifecycle";
import {
  notifyObservationAcknowledged,
  notifyManagerObservationAcknowledged,
} from "@/lib/notifications/observation-notifications";
import { randomUUID } from "crypto";
import type { ObservationStatus } from "@/features/observations/types";

interface AcknowledgeObservationRow {
  id: string;
  staffId: string;
  managerId: string | null;
  status: ObservationStatus;
  acknowledgedAt: Date | string | null;
  acknowledgementResponse: string | null;
  staffEmail: string;
  staffName: string | null;
  managerEmail: string | null;
  managerName: string | null;
  rubricName: string | null;
  title: string | null;
  acknowledgementMethod: "personal" | "automatic" | null;
  acknowledgementNote: string | null;
}

interface LockedAcknowledgementRow {
  status: ObservationStatus;
  acknowledgementMethod: "personal" | "automatic" | null;
}

interface AcknowledgedObservationRow {
  id: string;
  status: ObservationStatus;
  acknowledgedAt: Date | string;
  staffId: string;
  managerId: string | null;
}

interface AdminEmailRow {
  id: string;
  email: string;
}

function serializeDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getObservationSession();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = session.user.id as string;
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      response?: unknown;
    };
    const acknowledgementResponse =
      typeof body.response === "string" ? body.response.trim() : "";

    // Load full observation with staff/manager info
    const observation = await queryOne<AcknowledgeObservationRow>(
      `SELECT
         o.id,
         o."staffId",
         o."managerId",
         o.status,
         o.acknowledged_at AS "acknowledgedAt",
         o.acknowledgement_response AS "acknowledgementResponse",
         o.acknowledgement_method AS "acknowledgementMethod",
         o.acknowledgement_note AS "acknowledgementNote",
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

    const roles = ((session.user as { roles?: string[] }).roles ?? []) as string[];
    const permissions = getObservationPermissions(
      { id: userId, roles },
      {
        status: observation.status,
        staffId: String(observation.staffId),
        managerId: observation.managerId ? String(observation.managerId) : null,
      },
    );

    if (
      observation.status === "acknowledged" &&
      observation.acknowledgementMethod !== "automatic" &&
      String(observation.staffId) === String(userId)
    ) {
      return NextResponse.json({
        id: observation.id,
        status: observation.status,
        acknowledgedAt: observation.acknowledgedAt
          ? serializeDate(observation.acknowledgedAt)
          : null,
        staffId: observation.staffId,
        managerId: observation.managerId,
        acknowledgementResponse: observation.acknowledgementResponse,
        acknowledgementMethod: observation.acknowledgementMethod,
        acknowledgementNote: observation.acknowledgementNote,
      });
    }

    const canReplaceAutomaticAcknowledgement =
      observation.status === "acknowledged" &&
      observation.acknowledgementMethod === "automatic" &&
      String(observation.staffId) === String(userId);

    if (!permissions.canAcknowledge && !canReplaceAutomaticAcknowledgement)
      return NextResponse.json(
        {
          error:
            observation.status === "submitted"
              ? "Forbidden: only the observed staff member can acknowledge this observation."
              : `Observation must be in 'submitted' status to acknowledge. Current: ${observation.status}`,
        },
        { status: observation.status === "submitted" ? 403 : 400 },
      );

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

    if (observation.status === "submitted") {
      assertObservationTransition("submitted", "acknowledged");
    }

    const client = await pool.connect();
    let updated: AcknowledgedObservationRow;
    try {
      await client.query("BEGIN");
      const lockResult = await client.query<LockedAcknowledgementRow>(
        `SELECT
           status,
           acknowledgement_method AS "acknowledgementMethod"
         FROM observations
         WHERE id = $1
         FOR UPDATE`,
        [id],
      );
      const locked = lockResult.rows[0];
      const canPersonallyAcknowledge =
        locked?.status === "submitted" ||
        (locked?.status === "acknowledged" &&
          locked.acknowledgementMethod === "automatic");
      if (!canPersonallyAcknowledge) {
        throw new Error("Observation status changed before acknowledgement.");
      }

      const updateResult = await client.query<AcknowledgedObservationRow>(
        `UPDATE observations
         SET status = 'acknowledged',
             acknowledged_at = NOW(),
             acknowledgement_response = $2,
             acknowledgement_method = 'personal',
             acknowledgement_note = NULL,
             updated_at = NOW()
         WHERE id = $1
         RETURNING
           id,
           status,
           acknowledged_at AS "acknowledgedAt",
           "staffId",
           "managerId"`,
        [id, acknowledgementResponse],
      );
      const updatedRow = updateResult.rows[0];
      if (!updatedRow) throw new Error("Observation status changed before acknowledgement.");
      updated = updatedRow;

      await client.query(
        `INSERT INTO observation_updates
           (id, observation_id, updated_by_id, status_from, status_to, event_type, notes, created_at)
         VALUES ($1, $2, $3, $4, 'acknowledged', 'acknowledged', $5, NOW())`,
        [
          randomUUID(),
          id,
          userId,
          locked.status,
          acknowledgementResponse,
        ],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    // AC: Notify the assigned observer
    if (observation.managerEmail) {
      await notifyManagerObservationAcknowledged(
        observation.managerId!,
        observation.managerEmail,
        observation.staffName ?? observation.staffEmail ?? "Staff",
        observation.managerName ?? observation.managerEmail ?? "Observer",
        observation.title?.trim() || observation.rubricName || "Observation",
        id,
      ).catch((err: unknown) =>
        console.error("[acknowledge] manager notify error:", err),
      );
    }

    // Also notify admins (skip if manager is also admin to avoid duplicate)
    const adminUsers = await query<AdminEmailRow>(
      `SELECT u.id, u.email FROM users u
       JOIN user_roles ur ON ur.user_id = u.id
       WHERE ur.role = 'admin' AND u.status = 'active'
       LIMIT 3`,
    );

    for (const adminUser of adminUsers) {
      if (adminUser.email && adminUser.email !== observation.managerEmail) {
        await notifyObservationAcknowledged(
          adminUser.id,
          adminUser.email,
          observation.staffName ?? observation.staffEmail ?? "Staff",
          observation.managerName ?? observation.managerEmail ?? "Observer",
          observation.title?.trim() || observation.rubricName || "Observation",
          id,
        ).catch((err: unknown) =>
          console.error("[acknowledge] admin notify error:", err),
        );
      }
    }

    return NextResponse.json({
      id: updated.id,
      status: updated.status,
      acknowledgedAt: serializeDate(updated.acknowledgedAt),
      staffId: updated.staffId,
      managerId: updated.managerId,
      acknowledgementResponse,
      acknowledgementMethod: "personal",
      acknowledgementNote: null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("PATCH /api/observations/[id]/acknowledge error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
