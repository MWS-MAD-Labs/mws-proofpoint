import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";

// POST /api/rubrics/kpis - Create new KPI
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      standard_id,
      name,
      description,
      evidence_guidance,
      trainings,
      sort_order,
      rubric_4,
      rubric_3,
      rubric_2,
      rubric_1,
    } = body;

    if (
      !standard_id ||
      !name ||
      !rubric_4 ||
      !rubric_3 ||
      !rubric_2 ||
      !rubric_1
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const standard = await queryOne<{ template_id: string }>(
      `SELECT template_id FROM kpi_standards WHERE id = $1`,
      [standard_id],
    );
    if (!standard) {
      return NextResponse.json(
        { error: "Standard not found" },
        { status: 404 },
      );
    }
    const next = await queryOne<{ next_order: string; next_code: string }>(
      `SELECT
                COALESCE(MAX(sort_order) FILTER (WHERE standard_id = $1), 0) + 1 AS next_order,
                COUNT(*) + 1 AS next_code
             FROM kpis
             WHERE template_id = $2`,
      [standard_id, standard.template_id],
    );
    const order = sort_order || Number(next?.next_order ?? 1);
    const newKPI = await queryOne(
      `INSERT INTO kpis (standard_id, template_id, name, description, evidence_guidance, trainings, sort_order, code, rubric_4, rubric_3, rubric_2, rubric_1)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             RETURNING *`,
      [
        standard_id,
        standard.template_id,
        name,
        description,
        evidence_guidance,
        trainings,
        order,
        `K${Number(next?.next_code ?? 1)}`,
        rubric_4,
        rubric_3,
        rubric_2,
        rubric_1,
      ],
    );

    return NextResponse.json({ data: newKPI }, { status: 201 });
  } catch (error) {
    console.error("Create KPI error:", error);
    return NextResponse.json(
      { error: "Failed to create KPI" },
      { status: 500 },
    );
  }
}

// PATCH /api/rubrics/kpis - Update KPI
export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      id,
      name,
      description,
      evidence_guidance,
      trainings,
      sort_order,
      rubric_4,
      rubric_3,
      rubric_2,
      rubric_1,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: "KPI ID is required" },
        { status: 400 },
      );
    }

    const updatedKPI = await queryOne(
      `UPDATE kpis
             SET name = COALESCE($1, name),
                 description = COALESCE($2, description),
                 evidence_guidance = COALESCE($3, evidence_guidance),
                 trainings = COALESCE($4, trainings),
                 sort_order = COALESCE($5, sort_order),
                 rubric_4 = COALESCE($6, rubric_4),
                 rubric_3 = COALESCE($7, rubric_3),
                 rubric_2 = COALESCE($8, rubric_2),
                 rubric_1 = COALESCE($9, rubric_1)
             WHERE id = $10
             RETURNING *`,
      [
        name,
        description,
        evidence_guidance,
        trainings,
        sort_order,
        rubric_4,
        rubric_3,
        rubric_2,
        rubric_1,
        id,
      ],
    );

    if (!updatedKPI) {
      return NextResponse.json({ error: "KPI not found" }, { status: 404 });
    }

    return NextResponse.json({ data: updatedKPI });
  } catch (error) {
    console.error("Update KPI error:", error);
    return NextResponse.json(
      { error: "Failed to update KPI" },
      { status: 500 },
    );
  }
}

// DELETE /api/rubrics/kpis - Delete KPI
export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "KPI ID is required" },
        { status: 400 },
      );
    }

    await query(`DELETE FROM kpis WHERE id = $1`, [id]);

    return NextResponse.json({ message: "KPI deleted successfully" });
  } catch (error) {
    console.error("Delete KPI error:", error);
    return NextResponse.json(
      { error: "Failed to delete KPI" },
      { status: 500 },
    );
  }
}
