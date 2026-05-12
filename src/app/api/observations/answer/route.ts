// src/app/api/observations/answer/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { randomUUID } from "crypto";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { observationId, indicatorId, score, note, textValue, selectedOption } = body;

    if (!observationId || !indicatorId)
      return NextResponse.json(
        { error: "observationId and indicatorId are required" },
        { status: 400 }
      );

    // Get observation - use explicit column aliases to avoid camelCase issues
    const observation = await queryOne(
      `SELECT id, "managerId" as manager_id, "staffId" as staff_id
       FROM observations WHERE id = $1`,
      [observationId]
    ) as any;

    if (!observation)
      return NextResponse.json({ error: "Observation not found" }, { status: 404 });

    const userRoles = (session.user as any).roles ?? [];
    const isAdmin   = userRoles.includes("admin");
    const isManager = observation.manager_id === session.user.id;
    const isStaff   = observation.staff_id   === session.user.id;

    if (!isAdmin && !isManager && !isStaff)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Get question_type
    const indicator = await queryOne(
      `SELECT id, question_type FROM rubric_indicators WHERE id = $1`,
      [indicatorId]
    ) as any;

    if (!indicator)
      return NextResponse.json({ error: "Indicator not found" }, { status: 404 });

    const qType = indicator.question_type ?? "SCALE";

    // Upsert answer
    const existing = await queryOne(
      `SELECT id FROM observation_answers
       WHERE observation_id = $1 AND indicator_id = $2`,
      [observationId, indicatorId]
    ) as any;

    let answer: any = null;

    if (existing) {
      if (qType === "SCALE") {
        answer = await queryOne(
          `UPDATE observation_answers
           SET score = $1, note = $2, updated_at = NOW()
           WHERE id = $3 RETURNING *`,
          [score ?? 0, note ?? "", existing.id]
        );
      } else if (qType === "TEXT") {
        answer = await queryOne(
          `UPDATE observation_answers
           SET text_value = $1, updated_at = NOW()
           WHERE id = $2 RETURNING *`,
          [textValue ?? null, existing.id]
        );
      } else {
        answer = await queryOne(
          `UPDATE observation_answers
           SET selected_option = $1, updated_at = NOW()
           WHERE id = $2 RETURNING *`,
          [selectedOption ?? null, existing.id]
        );
      }
    } else {
      if (qType === "SCALE") {
        answer = await queryOne(
          `INSERT INTO observation_answers
           (id, observation_id, indicator_id, score, note, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING *`,
          [randomUUID(), observationId, indicatorId, score ?? 0, note ?? ""]
        );
      } else if (qType === "TEXT") {
        answer = await queryOne(
          `INSERT INTO observation_answers
           (id, observation_id, indicator_id, score, note, text_value, created_at, updated_at)
           VALUES ($1, $2, $3, 0, '', $4, NOW(), NOW()) RETURNING *`,
          [randomUUID(), observationId, indicatorId, textValue ?? null]
        );
      } else {
        answer = await queryOne(
          `INSERT INTO observation_answers
           (id, observation_id, indicator_id, score, note, selected_option, created_at, updated_at)
           VALUES ($1, $2, $3, 0, '', $4, NOW(), NOW()) RETURNING *`,
          [randomUUID(), observationId, indicatorId, selectedOption ?? null]
        );
      }
    }

    // Normalize response
    const normalized = answer ? {
      id:             answer.id,
      indicatorId:    answer.indicator_id,
      observationId:  answer.observation_id,
      score:          answer.score,
      note:           answer.note,
      textValue:      answer.text_value      ?? null,
      selectedOption: answer.selected_option ?? null,
    } : null;

    return NextResponse.json({ data: normalized });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("POST /api/observations/answer error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}