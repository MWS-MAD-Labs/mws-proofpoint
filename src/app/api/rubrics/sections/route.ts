import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { randomUUID } from "crypto";

// POST /api/rubrics/sections - Create new section
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { template_id, name, weight, sort_order } = body;

        if (!template_id || !name || weight === undefined) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const id = randomUUID();

        const newSection = await queryOne(
            `INSERT INTO rubric_sections (id, template_id, name, weight, sort_order)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [id, template_id, name, weight, sort_order || 0]
        );

        return NextResponse.json({ data: newSection }, { status: 201 });
    } catch (error) {
        console.error("Create section error:", error);
        return NextResponse.json({ error: "Failed to create section" }, { status: 500 });
    }
}

// PATCH /api/rubrics/sections - Update section
export async function PATCH(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { id, name, weight, sort_order } = body;

        if (!id) {
            return NextResponse.json({ error: "Section ID is required" }, { status: 400 });
        }

        const updatedSection = await queryOne(
            `UPDATE rubric_sections 
             SET name = COALESCE($1, name), 
                 weight = COALESCE($2, weight), 
                 sort_order = COALESCE($3, sort_order)
             WHERE id = $4
             RETURNING *`,
            [name, weight, sort_order, id]
        );

        if (!updatedSection) {
            return NextResponse.json({ error: "Section not found" }, { status: 404 });
        }

        return NextResponse.json({ data: updatedSection });
    } catch (error) {
        console.error("Update section error:", error);
        return NextResponse.json({ error: "Failed to update section" }, { status: 500 });
    }
}

// DELETE /api/rubrics/sections - Delete section
export async function DELETE(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json({ error: "Section ID is required" }, { status: 400 });
        }

        await query(`DELETE FROM rubric_sections WHERE id = $1`, [id]);

        return NextResponse.json({ message: "Section deleted successfully" });
    } catch (error) {
        console.error("Delete section error:", error);
        return NextResponse.json({ error: "Failed to delete section" }, { status: 500 });
    }
}