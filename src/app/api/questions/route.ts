import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";

// GET /api/questions - List questions for an assessment
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const assessmentId = searchParams.get("assessmentId");
        const askedBy = searchParams.get("askedBy");

        let sql = `
      SELECT q.*, 
             ap.full_name as asked_by_name,
             rp.full_name as responded_by_name,
             ri.name as indicator_name
      FROM assessment_questions q
      LEFT JOIN profiles ap ON q.asked_by = ap.user_id
      LEFT JOIN profiles rp ON q.responded_by = rp.user_id
      LEFT JOIN rubric_indicators ri ON q.indicator_id = ri.id
      WHERE 1=1
    `;
        const params: unknown[] = [];
        let paramIndex = 1;

        if (assessmentId) {
            sql += ` AND q.assessment_id = $${paramIndex++}`;
            params.push(assessmentId);
        }

        if (askedBy) {
            sql += ` AND q.asked_by = $${paramIndex++}`;
            params.push(askedBy);
        }

        sql += ` ORDER BY q.created_at DESC`;

        const questions = await query(sql, params);
        return NextResponse.json({ data: questions });
    } catch (error) {
        console.error("Questions error:", error);
        return NextResponse.json({ error: "Failed to fetch questions" }, { status: 500 });
    }
}

// POST /api/questions - Create new question
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { assessment_id, indicator_id, question } = body;

        if (!assessment_id || !question) {
            return NextResponse.json({ error: "Assessment ID and question are required" }, { status: 400 });
        }

        const newQuestion = await queryOne(
            `INSERT INTO assessment_questions (assessment_id, indicator_id, asked_by, question)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
            [assessment_id, indicator_id ?? null, session.user.id, question]
        );

        return NextResponse.json({ data: newQuestion }, { status: 201 });
    } catch (error) {
        console.error("Create question error:", error);
        return NextResponse.json({ error: "Failed to create question" }, { status: 500 });
    }
}

// PUT /api/questions - Answer a question
export async function PUT(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { id, response, status } = body;

        if (!id) {
            return NextResponse.json({ error: "Question ID required" }, { status: 400 });
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
            [response, session.user.id, status ?? "answered", id]
        );

        return NextResponse.json({ data: updated });
    } catch (error) {
        console.error("Answer question error:", error);
        return NextResponse.json({ error: "Failed to answer question" }, { status: 500 });
    }
}
