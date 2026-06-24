// src/app/api/observations/[id]/submit/route.ts
// Milestone 4: Only the manager who owns the observation can submit it.
// On submit, status moves draft → submitted, and staff is notified.

import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { notifyObservationSubmitted } from "@/lib/notifications/observation-notifications";
import { randomUUID } from "crypto";

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = {
      id: session.user.id,
      roles: (session.user as any).roles ?? [],
    };
    const isAdmin = user.roles.includes("admin");
    const { id } = await params;

    // Load observation
    const observation = (await queryOne(
      `SELECT o.id, o."staffId", o."managerId", o.status,
              su.email as staff_email, sp.full_name as staff_name,
              rt.name as rubric_name
       FROM observations o
       LEFT JOIN users su ON su.id = o."staffId"
       LEFT JOIN profiles sp ON sp.user_id = su.id
       LEFT JOIN rubric_templates rt ON rt.id = o.template_id
       WHERE o.id = $1`,
      [id],
    )) as any;

    if (!observation)
      return NextResponse.json(
        { error: "Observation not found." },
        { status: 404 },
      );

    // ── AC: Only the manager who created this observation (or admin) can submit
    if (!isAdmin && observation.managerId !== user.id)
      return NextResponse.json(
        {
          error:
            "Forbidden: only the assigned manager can submit this observation.",
        },
        { status: 403 },
      );

    if (observation.status !== "draft")
      return NextResponse.json(
        { error: "Only draft observations can be submitted." },
        { status: 400 },
      );

    // Verify at least one indicator has been answered
    const answers = (await query(
      `SELECT score, note, text_value, selected_option
       FROM observation_answers WHERE observation_id = $1`,
      [id],
    )) as any[];

    const hasAnswer = answers.some(
      (a) => (a.score ?? 0) > 0 || a.text_value || a.selected_option,
    );
    if (!hasAnswer)
      return NextResponse.json(
        { error: "Please fill in at least one indicator before submitting." },
        { status: 400 },
      );

    // Update status: draft → submitted
    const updated = (await queryOne(
      `UPDATE observations
      SET status = 'submitted', submitted_at = NOW(), updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
      [id],
    )) as any;

    // Log status change
    await queryOne(
      `INSERT INTO observation_updates
         (id, observation_id, updated_by_id, status_from, status_to, notes, created_at)
       VALUES ($1, $2, $3, 'draft', 'submitted', $4, NOW())`,
      [
        randomUUID(),
        id,
        user.id,
        `Submitted by ${isAdmin ? "admin" : "manager"}`,
      ],
    ).catch((err: unknown) =>
      console.error("ObservationUpdate log error:", err),
    );

    // Notify staff
    await notifyObservationSubmitted(
      observation.staff_email,
      observation.staff_name ?? observation.staff_email,
      observation.rubric_name ?? "Observation",
      id,
    ).catch((err: unknown) => console.error("Submit notification error:", err));

    return NextResponse.json(updated);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("PATCH /api/observations/[id]/submit error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
