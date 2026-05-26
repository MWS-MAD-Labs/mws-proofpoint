// src/app/api/observations/route.ts
// Milestone 4: Manager observation runtime

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { notifyObservationCreated } from "@/lib/notifications/observation-notifications";
import { randomUUID } from "crypto";

// ── GET /api/observations ─────────────────────────────────────────────────────
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user       = { id: session.user.id, roles: (session.user as any).roles ?? [] };
  const isAdmin    = user.roles.includes("admin");
  const isDirector = user.roles.includes("director");
  const isManager  = user.roles.includes("manager");

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  try {
    let whereClause = "WHERE 1=1";
    const params: string[] = [];
    let paramIdx = 1;

    if (!isAdmin && !isDirector) {
      if (isManager) {
        whereClause += ` AND o."managerId" = $${paramIdx++}`;
        params.push(user.id);
      } else {
        whereClause += ` AND o."staffId" = $${paramIdx++}`;
        params.push(user.id);
      }
    }

    if (status) {
      whereClause += ` AND o.status = $${paramIdx++}`;
      params.push(status);
    }

    const observations = await query(
      `SELECT
         o.id,
         o."staffId",
         o."managerId",
         o.template_id   AS "rubricId",
         o.status,
         o.created_at    AS "createdAt",
         o.updated_at    AS "updatedAt",
         o.submitted_at  AS "submittedAt",
         o.acknowledged_at AS "acknowledgedAt",
         -- staff
         su.id           AS staff_id,
         su.email        AS staff_email,
         sp.full_name    AS staff_full_name,
         -- manager
         mu.id           AS manager_id,
         mu.email        AS manager_email,
         mp.full_name    AS manager_full_name,
         -- rubric
         rt.id           AS rubric_id,
         rt.name         AS rubric_name
       FROM observations o
       LEFT JOIN users su           ON su.id = o."staffId"
       LEFT JOIN profiles sp        ON sp.user_id = su.id
       LEFT JOIN users mu           ON mu.id = o."managerId"
       LEFT JOIN profiles mp        ON mp.user_id = mu.id
       LEFT JOIN rubric_templates rt ON rt.id = o.template_id
       ${whereClause}
       ORDER BY o.created_at DESC`,
      params
    ) as any[];

    const obsIds = observations.map((o: any) => o.id);
    let answers: any[] = [];
    if (obsIds.length > 0) {
      answers = await query(
        `SELECT * FROM observation_answers WHERE observation_id = ANY($1)`,
        [obsIds]
      ) as any[];
    }

    const mapped = observations.map((o: any) => ({
      id:            o.id,
      staffId:       o.staffId,
      managerId:     o.managerId,
      rubricId:      o.rubricId,
      status:        o.status,
      createdAt:     o.createdAt,
      updatedAt:     o.updatedAt,
      submittedAt:   o.submittedAt,
      acknowledgedAt: o.acknowledgedAt,
      staff:   o.staff_id   ? { id: o.staff_id,   email: o.staff_email,   profile: { fullName: o.staff_full_name   } } : null,
      manager: o.manager_id ? { id: o.manager_id, email: o.manager_email, profile: { fullName: o.manager_full_name } } : null,
      rubric:  o.rubric_id  ? { id: o.rubric_id,  name: o.rubric_name } : null,
      answers: answers
        .filter((a: any) => a.observation_id === o.id)
        .map((a: any) => ({
          ...a,
          indicatorId:    a.indicator_id,
          observationId:  a.observation_id,
          textValue:      a.text_value,
          selectedOption: a.selected_option,
        })),
    }));

    return NextResponse.json(mapped);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("GET /api/observations error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── POST /api/observations ────────────────────────────────────────────────────
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user      = { id: session.user.id, roles: (session.user as any).roles ?? [] };
  const isAdmin   = user.roles.includes("admin");
  const isManager = user.roles.includes("manager");

  if (!isAdmin && !isManager) {
    return NextResponse.json(
      { error: "Only managers can create observations." },
      { status: 403 }
    );
  }

  try {
    const body       = await req.json().catch(() => ({}));
    const staffId    = body.staffId?.trim();
    const rubricId   = body.rubricId?.trim();
    const workflowId = body.workflowId?.trim();
    const managerId  = isAdmin
      ? (body.managerId?.trim() || user.id)
      : user.id;

    if (!staffId || !rubricId) {
      return NextResponse.json(
        { error: "staffId and rubricId are required." },
        { status: 400 }
      );
    }

    // ── Verify staff exists ───────────────────────────────────────────────
    const staff = await queryOne(
      `SELECT u.id, u.email, p.full_name AS "fullName"
       FROM users u LEFT JOIN profiles p ON p.user_id = u.id
       WHERE u.id = $1`,
      [staffId]
    ) as any;
    if (!staff)
      return NextResponse.json({ error: "Staff member not found." }, { status: 404 });

    // ── Verify rubric exists ──────────────────────────────────────────────
    const rubric = await queryOne(
      `SELECT rt.id, rt.name,
              json_agg(
                json_build_object(
                  'id', rs.id, 'name', rs.name,
                  'indicators', (
                    SELECT json_agg(json_build_object('id', ri.id, 'name', ri.name))
                    FROM rubric_indicators ri WHERE ri.section_id = rs.id
                  )
                )
              ) FILTER (WHERE rs.id IS NOT NULL) AS sections
       FROM rubric_templates rt
       LEFT JOIN rubric_sections rs ON rs.template_id = rt.id
       WHERE rt.id = $1
       GROUP BY rt.id`,
      [rubricId]
    ) as any;

    if (!rubric)
      return NextResponse.json({ error: "Rubric not found." }, { status: 404 });

    // ── AC: Validate workflow assignment if provided ───────────────────────
    if (workflowId) {
      const validAssignment = await queryOne(
        `SELECT rwa.id
         FROM role_workflow_assignments rwa
         JOIN workflow_definitions wd ON wd.id  = rwa.workflow_id
         JOIN department_roles dr     ON dr.id  = rwa.department_role_id
         JOIN user_roles ur           ON ur.role = dr.role
         WHERE rwa.workflow_id  = $1
           AND rwa.rubric_id    = $2
           AND ur.user_id       = $3
           AND rwa.is_active    = true`,
        [workflowId, rubricId, staffId]
      ) as any;

      if (!validAssignment) {
        return NextResponse.json(
          { error: "This workflow/rubric combination is not assigned to the staff member's role." },
          { status: 400 }
        );
      }
    }

    // ── Create observation ─────────────────────────────────────────────────
    const obsId = randomUUID();

    const observation = await queryOne(
      `INSERT INTO observations
         (id, "staffId", "managerId", template_id, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'draft', NOW(), NOW())
       RETURNING *`,
      [obsId, staffId, managerId, rubricId]
    ) as any;

    if (!observation)
      return NextResponse.json({ error: "Failed to create observation." }, { status: 500 });

    // ── Pre-create answer rows for all indicators ─────────────────────────
    const sections   = rubric.sections ?? [];
    const indicators = sections.flatMap((s: any) => s.indicators ?? []);
    for (const indicator of indicators) {
      await queryOne(
        `INSERT INTO observation_answers (id, observation_id, indicator_id, score, note)
         VALUES ($1, $2, $3, 0, '')
         ON CONFLICT (observation_id, indicator_id) DO NOTHING`,
        [randomUUID(), obsId, indicator.id]
      ).catch(() => {});
    }

    // ── Notify staff ──────────────────────────────────────────────────────
    await notifyObservationCreated(
      staff.email,
      staff.fullName || staff.email,
      rubric.name,
      obsId
    ).catch((err: unknown) => console.error("Notification error:", err));

    return NextResponse.json(observation, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("POST /api/observations error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}