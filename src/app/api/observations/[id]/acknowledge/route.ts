// src/app/api/observations/[id]/acknowledge/route.ts
// Milestone 5: Staff Acknowledgement
//
// Acceptance criteria:
//   ✓ Staff cannot edit scores — they only acknowledge (read-only).
//   ✓ Staff can only acknowledge observations where they are the subject.
//   ✓ Status updates to acknowledged.
//   ✓ Audit trail records acknowledgement.
//   ✓ Manager and admin are notified.

import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import {
  notifyObservationAcknowledged,
  notifyManagerObservationAcknowledged,
} from "@/lib/notifications/observation-notifications";
import { randomUUID } from "crypto";

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId  = session.user.id as string;
    const roles   = ((session.user as any).roles ?? []) as string[];
    const isAdmin = roles.includes("admin");
    const { id }  = await params;

    // Load full observation with staff/manager info
    const observation = await queryOne(
      `SELECT
         o.id,
         o."staffId",
         o."managerId",
         o.status,
         su.email        AS staff_email,
         sp.full_name    AS staff_name,
         mu.email        AS manager_email,
         mp.full_name    AS manager_name,
         rt.name         AS rubric_name
       FROM observations o
       LEFT JOIN users su    ON su.id = o."staffId"
       LEFT JOIN profiles sp ON sp.user_id = su.id
       LEFT JOIN users mu    ON mu.id = o."managerId"
       LEFT JOIN profiles mp ON mp.user_id = mu.id
       LEFT JOIN rubric_templates rt ON rt.id = o.template_id
       WHERE o.id = $1`,
      [id]
    ) as any;

    if (!observation)
      return NextResponse.json({ error: "Observation not found." }, { status: 404 });

    // AC: Only the observed staff member (or admin) can acknowledge.
    // Staff CANNOT acknowledge observations where they are NOT the subject.
    const isSubjectStaff = String(observation.staffId) === String(userId);
    if (!isAdmin && !isSubjectStaff)
      return NextResponse.json(
        { error: "Forbidden: only the observed staff member can acknowledge this observation." },
        { status: 403 }
      );

    // AC: Staff cannot edit scores — they can only acknowledge after manager submits.
    if (observation.status !== "submitted")
      return NextResponse.json(
        {
          error: `Observation must be in 'submitted' status to acknowledge. Current: ${observation.status}`,
        },
        { status: 400 }
      );

    // Update status: submitted → acknowledged
    const updated = await queryOne(
      `UPDATE observations
       SET status          = 'acknowledged',
           acknowledged_at = NOW(),
           updated_at      = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    ) as any;

    if (!updated)
      return NextResponse.json({ error: "Failed to update observation." }, { status: 500 });

    // AC: Audit trail records acknowledgement
    await queryOne(
      `INSERT INTO observation_updates
         (id, observation_id, updated_by, "statusFrom", "statusTo", notes, created_at)
       VALUES ($1, $2, $3, 'submitted', 'acknowledged', $4, NOW())`,
      [
        randomUUID(),
        id,
        userId,
        `Acknowledged by ${isAdmin ? "admin (on behalf of staff)" : "staff"}: ${
          observation.staff_name ?? observation.staff_email ?? "unknown"
        }`,
      ]
    ).catch((err: unknown) => console.error("[acknowledge] audit log error:", err));

    // AC: Notify the assigned manager
    if (observation.manager_email) {
      await notifyManagerObservationAcknowledged(
        observation.manager_email,
        observation.staff_name   ?? observation.staff_email   ?? "Staff",
        observation.manager_name ?? observation.manager_email ?? "Manager",
        observation.rubric_name  ?? "Observation",
        id
      ).catch((err: unknown) =>
        console.error("[acknowledge] manager notify error:", err)
      );
    }

    // Also notify admins (skip if manager is also admin to avoid duplicate)
    const adminUsers = (await query(
      `SELECT u.email FROM users u
       JOIN user_roles ur ON ur.user_id = u.id
       WHERE ur.role = 'admin' AND u.status = 'active'
       LIMIT 3`
    )) as any[];

    for (const adminUser of adminUsers) {
      if (adminUser.email && adminUser.email !== observation.manager_email) {
        await notifyObservationAcknowledged(
          adminUser.email,
          observation.staff_name   ?? observation.staff_email   ?? "Staff",
          observation.manager_name ?? observation.manager_email ?? "Manager",
          observation.rubric_name  ?? "Observation",
          id
        ).catch((err: unknown) =>
          console.error("[acknowledge] admin notify error:", err)
        );
      }
    }

    return NextResponse.json({
      id:             updated.id,
      status:         updated.status,
      acknowledgedAt: updated.acknowledged_at,
      staffId:        updated["staffId"],
      managerId:      updated["managerId"],
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("PATCH /api/observations/[id]/acknowledge error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}