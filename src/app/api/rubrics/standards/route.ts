import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";

// POST /api/rubrics/standards - Create new standard
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { domain_id, name, sort_order } = body;

    if (!domain_id || !name) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const domain = await queryOne<{ template_id: string }>(
      `SELECT template_id FROM kpi_domains WHERE id = $1`,
      [domain_id],
    );
    if (!domain) {
      return NextResponse.json({ error: "Domain not found" }, { status: 404 });
    }
    const next = await queryOne<{ next_order: string; next_code: string }>(
      `SELECT
          COALESCE(MAX(sort_order) FILTER (WHERE domain_id = $1), 0) + 1 AS next_order,
          COALESCE(
            MAX(
              CASE
                WHEN code ~ '^S[0-9]+$' THEN substring(code FROM 2)::integer
                ELSE 0
              END
            ),
            0
          ) + 1 AS next_code
       FROM kpi_standards
       WHERE template_id = $2`,
      [domain_id, domain.template_id],
    );
    const order = sort_order ?? Number(next?.next_order ?? 1);
    const newStandard = await queryOne(
      `INSERT INTO kpi_standards (domain_id, template_id, name, sort_order, code)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
      [
        domain_id,
        domain.template_id,
        name,
        order,
        `S${Number(next?.next_code ?? 1)}`,
      ],
    );

    return NextResponse.json({ data: newStandard }, { status: 201 });
  } catch (error) {
    console.error("Create standard error:", error);
    return NextResponse.json(
      { error: "Failed to create standard" },
      { status: 500 },
    );
  }
}

// PATCH /api/rubrics/standards - Update standard
export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, sort_order } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Standard ID is required" },
        { status: 400 },
      );
    }

    const updatedStandard = await queryOne(
      `UPDATE kpi_standards
             SET name = COALESCE($1, name),
                 sort_order = COALESCE($2, sort_order)
             WHERE id = $3
             RETURNING *`,
      [name, sort_order, id],
    );

    if (!updatedStandard) {
      return NextResponse.json(
        { error: "Standard not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: updatedStandard });
  } catch (error) {
    console.error("Update standard error:", error);
    return NextResponse.json(
      { error: "Failed to update standard" },
      { status: 500 },
    );
  }
}

// DELETE /api/rubrics/standards - Delete standard
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
        { error: "Standard ID is required" },
        { status: 400 },
      );
    }

    await query(`DELETE FROM kpi_standards WHERE id = $1`, [id]);

    return NextResponse.json({ message: "Standard deleted successfully" });
  } catch (error) {
    console.error("Delete standard error:", error);
    return NextResponse.json(
      { error: "Failed to delete standard" },
      { status: 500 },
    );
  }
}
