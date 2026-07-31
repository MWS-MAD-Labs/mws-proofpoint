import { randomUUID } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { getObservationSession } from "@/features/observations/server/auth";
import { pool, query, queryOne } from "@/lib/db";
import { getObservationPermissions } from "@/features/observations/server/permissions";
import {
  calculateObservationProgress,
  isObservationAnswerComplete,
} from "@/features/observations/server/validation";
import type {
  ObservationAnswerInput,
  ObservationIndicatorForProgress,
  ObservationQuestionType,
  ObservationStatusInput,
} from "@/features/observations/types";

interface ObservationRow {
  id: string;
  staffId: string;
  managerId: string | null;
  templateId: string;
  status: ObservationStatusInput;
}

interface IndicatorRow {
  id: string;
  name: string;
  sectionId: string;
  sectionName: string;
  questionType: string | null;
  scoreOptions: unknown;
  isRequired: boolean | null;
}

interface ProgressRow extends IndicatorRow {
  score: number | null;
  textValue: string | null;
  selectedOption: string | null;
}

interface AnswerRow {
  id: string;
  observationId: string;
  indicatorId: string;
  score: number | null;
  note: string | null;
  evidence: string | null;
  textValue: string | null;
  selectedOption: string | null;
  selectedOptions: unknown;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export async function PUT(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; indicatorId: string }> },
) {
  try {
    const session = await getObservationSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, indicatorId } = await params;
    const observation = await queryOne<ObservationRow>(
      `SELECT
         id,
         "staffId",
         "managerId",
         template_id AS "templateId",
         status
       FROM observations
       WHERE id = $1`,
      [id],
    );
    if (!observation) {
      return NextResponse.json(
        { error: "Observation not found." },
        { status: 404 },
      );
    }

    const user = {
      id: session.user.id,
      roles: (session.user as { roles?: string[] }).roles ?? [],
    };
    const permissions = getObservationPermissions(user, {
      status: observation.status,
      staffId: String(observation.staffId),
      managerId: observation.managerId
        ? String(observation.managerId)
        : null,
    });
    if (!permissions.canEdit) {
      return NextResponse.json(
        {
          error:
            observation.status === "draft"
              ? "Only the assigned manager or an administrator can edit this observation."
              : "Only draft observations can be edited.",
        },
        { status: observation.status === "draft" ? 403 : 409 },
      );
    }

    const indicator = await queryOne<IndicatorRow>(
      `SELECT
         ri.id,
         ri.name,
         rs.id AS "sectionId",
         rs.name AS "sectionName",
         ri.question_type AS "questionType",
         ri.score_options AS "scoreOptions",
         ri.is_required AS "isRequired"
       FROM rubric_indicators ri
       JOIN rubric_sections rs ON rs.id = ri.section_id
       WHERE ri.id = $1 AND rs.template_id = $2`,
      [indicatorId, observation.templateId],
    );
    if (!indicator) {
      return NextResponse.json(
        { error: "Indicator does not belong to this observation form." },
        { status: 404 },
      );
    }

    const questionType = normalizeQuestionType(indicator.questionType);
    const options = stringOptions(indicator.scoreOptions);
    const parsed = parseAnswerInput(await request.json(), questionType, options);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 422 });
    }

    const client = await pool.connect();
    let answer: AnswerRow;
    try {
      await client.query("BEGIN");
      const lockedObservation = await client.query<{
        status: ObservationStatusInput;
        managerId: string | null;
      }>(
        `SELECT status, "managerId" FROM observations WHERE id = $1 FOR UPDATE`,
        [id],
      );
      const locked = lockedObservation.rows[0];
      if (!locked || locked.status !== "draft") {
        const error = new Error("Only draft observations can be edited.");
        error.name = "OBSERVATION_NOT_EDITABLE";
        throw error;
      }
      const lockedPermissions = getObservationPermissions(user, {
        status: locked.status,
        staffId: String(observation.staffId),
        managerId: locked.managerId ? String(locked.managerId) : null,
      });
      if (!lockedPermissions.canEdit) {
        const error = new Error(
          "Only the assigned manager or an administrator can edit this observation.",
        );
        error.name = "OBSERVATION_NOT_EDITABLE";
        throw error;
      }
      const values = answerColumns(parsed.input);
      const result = await client.query<AnswerRow>(
        `INSERT INTO observation_answers
           (id, observation_id, indicator_id, score, note, text_value,
            selected_option, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
         ON CONFLICT (observation_id, indicator_id)
         DO UPDATE SET
           score = EXCLUDED.score,
           note = EXCLUDED.note,
           text_value = EXCLUDED.text_value,
           selected_option = EXCLUDED.selected_option,
           updated_at = NOW()
         RETURNING
           id,
           observation_id AS "observationId",
           indicator_id AS "indicatorId",
           score,
           note,
           evidence,
           text_value AS "textValue",
           selected_option AS "selectedOption",
           selected_options AS "selectedOptions",
           created_at AS "createdAt",
           updated_at AS "updatedAt"`,
        [
          randomUUID(),
          id,
          indicatorId,
          values.score,
          values.note,
          values.textValue,
          values.selectedOption,
        ],
      );
      const saved = result.rows[0];
      if (!saved) throw new Error("Answer was not saved.");
      answer = saved;
      await client.query(
        `UPDATE observations SET updated_at = NOW() WHERE id = $1`,
        [id],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    const progressRows = await query<ProgressRow>(
      `SELECT
         ri.id,
         ri.name,
         rs.id AS "sectionId",
         rs.name AS "sectionName",
         ri.question_type AS "questionType",
         ri.score_options AS "scoreOptions",
         ri.is_required AS "isRequired",
         oa.score,
         oa.text_value AS "textValue",
         oa.selected_option AS "selectedOption"
       FROM rubric_sections rs
       JOIN rubric_indicators ri ON ri.section_id = rs.id
       LEFT JOIN observation_answers oa
         ON oa.observation_id = $1 AND oa.indicator_id = ri.id
       WHERE rs.template_id = $2
       ORDER BY rs.sort_order ASC, ri.sort_order ASC`,
      [id, observation.templateId],
    );
    const progressIndicators: ObservationIndicatorForProgress[] =
      progressRows.map((row) => ({
        id: row.id,
        name: row.name,
        sectionId: row.sectionId,
        sectionName: row.sectionName,
        questionType: normalizeQuestionType(row.questionType),
        scoreOptions: stringOptions(row.scoreOptions),
        isRequired: row.isRequired ?? true,
        answer: {
          score: row.score,
          textValue: row.textValue,
          selectedOption: row.selectedOption,
        },
      }));
    const savedAt = serializeDate(answer.updatedAt);

    return NextResponse.json({
      answer: {
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
        updatedAt: savedAt,
      },
      savedAt,
      progress: calculateObservationProgress(progressIndicators),
    });
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Request body must be valid JSON." },
        { status: 400 },
      );
    }
    if (error instanceof Error && error.name === "OBSERVATION_NOT_EDITABLE") {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("PUT observation answer error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save answer." },
      { status: 500 },
    );
  }
}

type ParseResult =
  | { ok: true; input: ObservationAnswerInput }
  | { ok: false; error: string };

function parseAnswerInput(
  value: unknown,
  questionType: ObservationQuestionType,
  options: readonly string[],
): ParseResult {
  if (!isRecord(value) || value.type !== questionType) {
    return {
      ok: false,
      error: `Answer type must be ${questionType}.`,
    };
  }

  if (questionType === "SCALE") {
    const score = value.score;
    const note = value.note;
    if (
      typeof score !== "number" ||
      !Number.isFinite(score) ||
      score < 1 ||
      score > 4 ||
      Math.round(score * 10) !== score * 10
    ) {
      return { ok: false, error: "Score must be from 1.0 to 4.0 in 0.1 increments." };
    }
    if (note !== undefined && typeof note !== "string") {
      return { ok: false, error: "Note must be text." };
    }
    return { ok: true, input: { type: "SCALE", score, note: note?.trim() } };
  }

  if (questionType === "TEXT") {
    if (typeof value.textValue !== "string" || !value.textValue.trim()) {
      return { ok: false, error: "Text response cannot be blank." };
    }
    const input = { type: "TEXT", textValue: value.textValue.trim() } as const;
    if (!isObservationAnswerComplete("TEXT", input)) {
      return { ok: false, error: "Text response is invalid." };
    }
    return { ok: true, input };
  }

  if (
    typeof value.selectedOption !== "string" ||
    !value.selectedOption.trim()
  ) {
    return { ok: false, error: "A choice is required." };
  }
  const selectedOption = value.selectedOption.trim();
  if (
    !isObservationAnswerComplete(
      "CHOICE",
      { selectedOption },
      options,
    )
  ) {
    return { ok: false, error: "Selected choice is not a configured option." };
  }
  return { ok: true, input: { type: "CHOICE", selectedOption } };
}

function answerColumns(input: ObservationAnswerInput) {
  if (input.type === "SCALE") {
    return {
      score: input.score,
      note: input.note ?? "",
      textValue: null,
      selectedOption: null,
    };
  }
  if (input.type === "TEXT") {
    return {
      score: 0,
      note: "",
      textValue: input.textValue,
      selectedOption: null,
    };
  }
  return {
    score: 0,
    note: "",
    textValue: null,
    selectedOption: input.selectedOption,
  };
}

function normalizeQuestionType(value: string | null): ObservationQuestionType {
  return value === "TEXT" || value === "CHOICE" ? value : "SCALE";
}

function stringOptions(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((option): option is string => typeof option === "string")
    : [];
}

function serializeDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
