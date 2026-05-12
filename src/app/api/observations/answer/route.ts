// src/app/api/observations/answer/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { observationId, indicatorId, score, note, textValue, selectedOption } = body;

    if (!observationId || !indicatorId) {
      return NextResponse.json(
        { error: "observationId and indicatorId are required" },
        { status: 400 }
      );
    }

    // Verify user has access to this observation
    const observation = await queryOne(
      `SELECT o.*, rt.id as rubric_id
       FROM observations o
       LEFT JOIN rubric_templates rt ON o."rubricId" = rt.id
       WHERE o.id = $1`,
      [observationId]
    ) as any;

    if (!observation) {
      return NextResponse.json({ error: "Observation not found" }, { status: 404 });
    }

    const userRoles = (session.user as any).roles ?? [];
    const isAdmin   = userRoles.includes("admin");
    const isManager = observation.managerId === session.user.id;
    if (!isAdmin && !isManager) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get indicator question_type
    const indicator = await queryOne(
      `SELECT question_type FROM rubric_indicators WHERE id = $1`,
      [indicatorId]
    ) as any;

    const questionType = indicator?.question_type ?? "SCALE";

    // Check if answer exists
    const existing = await queryOne(
      `SELECT id FROM observation_answers WHERE "observationId" = $1 AND "indicatorId" = $2`,
      [observationId, indicatorId]
    ) as any;

    let answer;
    if (existing) {
      if (questionType === "SCALE") {
        answer = await queryOne(
          `UPDATE observation_answers
           SET score = COALESCE($1, score), note = COALESCE($2, note), updated_at = NOW()
           WHERE id = $3 RETURNING *`,
          [score ?? null, note ?? null, existing.id]
        );
      } else if (questionType === "TEXT") {
        answer = await queryOne(
          `UPDATE observation_answers
           SET text_value = $1, updated_at = NOW()
           WHERE id = $2 RETURNING *`,
          [textValue ?? null, existing.id]
        );
      } else if (questionType === "CHOICE") {
        answer = await queryOne(
          `UPDATE observation_answers
           SET selected_option = $1, updated_at = NOW()
           WHERE id = $2 RETURNING *`,
          [selectedOption ?? null, existing.id]
        );
      }
    } else {
      if (questionType === "SCALE") {
        answer = await queryOne(
          `INSERT INTO observation_answers ("observationId", "indicatorId", score, note)
           VALUES ($1, $2, $3, $4) RETURNING *`,
          [observationId, indicatorId, score ?? 0, note ?? ""]
        );
      } else if (questionType === "TEXT") {
        answer = await queryOne(
          `INSERT INTO observation_answers ("observationId", "indicatorId", score, note, text_value)
           VALUES ($1, $2, 0, '', $3) RETURNING *`,
          [observationId, indicatorId, textValue ?? null]
        );
      } else if (questionType === "CHOICE") {
        answer = await queryOne(
          `INSERT INTO observation_answers ("observationId", "indicatorId", score, note, selected_option)
           VALUES ($1, $2, 0, '', $3) RETURNING *`,
          [observationId, indicatorId, selectedOption ?? null]
        );
      }
    }

    return NextResponse.json({ data: answer });
  } catch (error) {
    console.error("Save observation answer error:", error);
    return NextResponse.json({ error: "Failed to save answer" }, { status: 500 });
  }
}