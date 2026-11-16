import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import {
  canRespondToAssessmentQuestion,
  getAssessmentPermissions,
} from "@/features/assessments/server/permissions";

type AssessmentAccessRow = {
  staffId: string;
  managerId: string | null;
  directorId: string | null;
  status: string;
  workflowSnapshot: unknown;
};

async function getAssessmentAccess(assessmentId: string) {
  return queryOne<AssessmentAccessRow>(
    `SELECT staff_id AS "staffId",
            manager_id AS "managerId",
            director_id AS "directorId",
            status,
            workflow_snapshot AS "workflowSnapshot"
       FROM assessments
      WHERE id = $1`,
    [assessmentId],
  );
}

function actorFromSession(session: { user: { id: string; roles?: string[] } }) {
  return { id: session.user.id, roles: session.user.roles ?? [] };
}

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const assessmentId = searchParams.get("assessmentId");
    const askedBy = searchParams.get("askedBy");
    if (!assessmentId) {
      return NextResponse.json({ error: "Assessment ID required" }, { status: 400 });
    }

    const assessment = await getAssessmentAccess(assessmentId);
    if (!assessment) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }
    const actor = actorFromSession(session);
    if (!getAssessmentPermissions(actor, assessment).canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const params: unknown[] = [assessmentId];
    const askedByFilter = askedBy ? "AND q.asked_by = $2" : "";
    if (askedBy) params.push(askedBy);
    const questions = await query(
      `SELECT q.*,
              ap.full_name AS asked_by_name,
              rp.full_name AS responded_by_name,
              ri.name AS indicator_name
         FROM assessment_questions q
         LEFT JOIN profiles ap ON q.asked_by = ap.user_id
         LEFT JOIN profiles rp ON q.responded_by = rp.user_id
         LEFT JOIN rubric_indicators ri ON q.indicator_id = ri.id
        WHERE q.assessment_id = $1
          ${askedByFilter}
        ORDER BY q.created_at DESC`,
      params,
    );
    return NextResponse.json({ data: questions });
  } catch (error) {
    console.error("Questions error:", error);
    return NextResponse.json({ error: "Failed to fetch questions" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { assessment_id, indicator_id, question } = body;
    if (!assessment_id || typeof question !== "string" || !question.trim()) {
      return NextResponse.json(
        { error: "Assessment ID and question are required" },
        { status: 400 },
      );
    }

    const assessment = await getAssessmentAccess(assessment_id);
    if (!assessment) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }
    const actor = actorFromSession(session);
    if (!getAssessmentPermissions(actor, assessment).canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (indicator_id) {
      const indicator = await queryOne<{ valid: boolean }>(
        `SELECT EXISTS (
           SELECT 1
             FROM assessments a
             JOIN rubric_sections section ON section.template_id = a.template_id
             JOIN rubric_indicators indicator ON indicator.section_id = section.id
            WHERE a.id = $1 AND indicator.id = $2
         ) AS valid`,
        [assessment_id, indicator_id],
      );
      if (!indicator?.valid) {
        return NextResponse.json(
          { error: "Indicator does not belong to this assessment" },
          { status: 400 },
        );
      }
    }

    const newQuestion = await queryOne(
      `INSERT INTO assessment_questions (assessment_id, indicator_id, asked_by, question)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [assessment_id, indicator_id ?? null, session.user.id, question.trim()],
    );
    return NextResponse.json({ data: newQuestion }, { status: 201 });
  } catch (error) {
    console.error("Create question error:", error);
    return NextResponse.json({ error: "Failed to create question" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, response, status } = body;
    if (!id || typeof response !== "string" || !response.trim()) {
      return NextResponse.json({ error: "Question ID and response required" }, { status: 400 });
    }

    const question = await queryOne<AssessmentAccessRow>(
      `SELECT a.staff_id AS "staffId",
              a.manager_id AS "managerId",
              a.director_id AS "directorId",
              a.status,
              a.workflow_snapshot AS "workflowSnapshot"
         FROM assessment_questions q
         JOIN assessments a ON a.id = q.assessment_id
        WHERE q.id = $1`,
      [id],
    );
    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }
    if (!canRespondToAssessmentQuestion(actorFromSession(session), question)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updated = await queryOne(
      `UPDATE assessment_questions
          SET response = $1,
              responded_by = $2,
              responded_at = now(),
              status = $3,
              updated_at = now()
        WHERE id = $4
        RETURNING *`,
      [response.trim(), session.user.id, status ?? "answered", id],
    );
    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("Answer question error:", error);
    return NextResponse.json({ error: "Failed to answer question" }, { status: 500 });
  }
}
