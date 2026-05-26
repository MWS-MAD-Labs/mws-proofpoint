import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { randomUUID } from "crypto";

const VALID_QUESTION_TYPES = ["SCALE", "CHOICE", "TEXT"];

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { section_id, name, description, sort_order, evidence_guidance,
                score_options, question_type, score_min, score_max, score_step, placeholder_text } = body;

        if (!section_id || !name) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const finalQuestionType = VALID_QUESTION_TYPES.includes(question_type) ? question_type : "SCALE";
        const id = randomUUID();

        const newIndicator = await queryOne(
            `INSERT INTO rubric_indicators
             (id, section_id, name, description, sort_order, evidence_guidance,
              score_options, question_type, score_min, score_max, score_step, placeholder_text)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
             RETURNING *`,
            [id, section_id, name, description ?? null, sort_order || 0,
             evidence_guidance ?? null,
             score_options ? JSON.stringify(score_options) : null,
             finalQuestionType,
             score_min ?? null, score_max ?? null, score_step ?? null,
             placeholder_text ?? null]
        );

        return NextResponse.json({ data: newIndicator }, { status: 201 });
    } catch (error) {
        console.error("Create indicator error:", error);
        return NextResponse.json({ error: "Failed to create indicator" }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { id, name, description, sort_order, evidence_guidance,
                score_options, question_type, score_min, score_max, score_step, placeholder_text } = body;

        if (!id) {
            return NextResponse.json({ error: "Indicator ID is required" }, { status: 400 });
        }

        const finalQuestionType = question_type && VALID_QUESTION_TYPES.includes(question_type)
            ? question_type : undefined;

        const updatedIndicator = await queryOne(
            `UPDATE rubric_indicators
             SET name               = COALESCE($1, name),
                 description        = COALESCE($2, description),
                 sort_order         = COALESCE($3, sort_order),
                 evidence_guidance  = COALESCE($4, evidence_guidance),
                 score_options      = COALESCE($5, score_options),
                 question_type      = COALESCE($6::\"IndicatorQuestionType\", question_type),
                 score_min          = COALESCE($7, score_min),
                 score_max          = COALESCE($8, score_max),
                 score_step         = COALESCE($9, score_step),
                 placeholder_text   = COALESCE($10, placeholder_text)
             WHERE id = $11
             RETURNING *`,
            [name, description, sort_order, evidence_guidance,
             score_options ? JSON.stringify(score_options) : null,
             finalQuestionType ?? null,
             score_min ?? null, score_max ?? null, score_step ?? null,
             placeholder_text ?? null, id]
        );

        if (!updatedIndicator) {
            return NextResponse.json({ error: "Indicator not found" }, { status: 404 });
        }

        return NextResponse.json({ data: updatedIndicator });
    } catch (error) {
        console.error("Update indicator error:", error);
        return NextResponse.json({ error: "Failed to update indicator" }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json({ error: "Indicator ID is required" }, { status: 400 });
        }

        await query(`DELETE FROM rubric_indicators WHERE id = $1`, [id]);
        return NextResponse.json({ message: "Indicator deleted successfully" });
    } catch (error) {
        console.error("Delete indicator error:", error);
        return NextResponse.json({ error: "Failed to delete indicator" }, { status: 500 });
    }
}