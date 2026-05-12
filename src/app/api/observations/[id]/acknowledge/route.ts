// src/app/api/observations/[id]/acknowledge/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { notifyObservationAcknowledged } from "@/lib/notifications/observation-notifications";
import { randomUUID } from "crypto";

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user    = { id: session.user.id, roles: (session.user as any).roles ?? [] };
    const isAdmin = user.roles.includes("admin");
    const { id }  = await params;

    const observation = await queryOne(
      `SELECT o.id, o."staffId", o."managerId", o.status,
              su.email as staff_email, sp.full_name as staff_name,
              mu.email as manager_email, mp.full_name as manager_name,
              rt.name as rubric_name
       FROM observations o
       LEFT JOIN users su ON su.id = o."staffId"
       LEFT JOIN profiles sp ON sp.user_id = su.id
       LEFT JOIN users mu ON mu.id = o."managerId"
       LEFT JOIN profiles mp ON mp.user_id = mu.id
       LEFT JOIN rubric_templates rt ON rt.id = o."rubricId"
       WHERE o.id = $1`,
      [id]
    ) as any;

    if (!observation)
      return NextResponse.json({ error: "Observation not found." }, { status: 404 });

    if (observation.status !== "pending")
      return NextResponse.json(
        { error: "Observation must be 'pending' before it can be acknowledged." },
        { status: 400 }
      );

    if (!isAdmin && observation.staffId !== user.id)
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });

    const updated = await queryOne(
      `UPDATE observations
       SET status = 'acknowledged', acknowledged_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    ) as any;

    await queryOne(
      `INSERT INTO observation_updates (id, observation_id, updated_by_id, status_from, status_to, notes, created_at)
       VALUES ($1, $2, $3, 'pending', 'acknowledged', $4, NOW())`,
      [randomUUID(), id, user.id, `Acknowledged by ${isAdmin ? "admin" : "staff"}`]
    ).catch((err: unknown) => console.error("ObservationUpdate error:", err));

    const adminUser = await queryOne(
      `SELECT u.email FROM users u
       JOIN user_roles ur ON ur.user_id = u.id
       WHERE ur.role = 'admin' LIMIT 1`
    ) as any;

    if (adminUser) {
      await notifyObservationAcknowledged(
        adminUser.email,
        observation.staff_name   ?? observation.staff_email,
        observation.manager_name ?? observation.manager_email ?? "Manager",
        observation.rubric_name  ?? "Observation",
        id
      ).catch((err: unknown) => console.error("Acknowledge notification error:", err));
    }

    return NextResponse.json(updated);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("PATCH /api/observations/[id]/acknowledge error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}