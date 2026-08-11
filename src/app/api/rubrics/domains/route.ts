import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";

// POST /api/rubrics/domains - Create new domain
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { template_id, name, sort_order } = body;

    if (!template_id || !name) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const next = await queryOne<{ next_order: string; next_code: string }>(
      `SELECT
          COALESCE(MAX(sort_order), 0) + 1 AS next_order,
          COALESCE(
            MAX(
              CASE
                WHEN code ~ '^D[0-9]+$' THEN substring(code FROM 2)::integer
                ELSE 0
              END
            ),
            0
          ) + 1 AS next_code
       FROM kpi_domains
       WHERE template_id = $1`,
      [template_id],
    );
    const order = sort_order ?? Number(next?.next_order ?? 1);
    const newDomain = await queryOne(
      `INSERT INTO kpi_domains (template_id, name, sort_order, code)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
      [template_id, name, order, `D${Number(next?.next_code ?? 1)}`],
    );

    return NextResponse.json({ data: newDomain }, { status: 201 });
  } catch (error) {
    console.error("Create domain error:", error);
    return NextResponse.json(
      { error: "Failed to create domain" },
      { status: 500 },
    );
  }
}

// PATCH /api/rubrics/domains - Update domain
export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, sort_order, weight } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Domain ID is required" },
        { status: 400 },
      );
    }

    const updatedDomain = await queryOne(
      `UPDATE kpi_domains
             SET name = COALESCE($1, name),
                 sort_order = COALESCE($2, sort_order),
                 weight = COALESCE($3, weight)
             WHERE id = $4
             RETURNING *`,
      [name, sort_order, weight, id],
    );

    if (!updatedDomain) {
      return NextResponse.json({ error: "Domain not found" }, { status: 404 });
    }

    return NextResponse.json({ data: updatedDomain });
  } catch (error) {
    console.error("Update domain error:", error);
    return NextResponse.json(
      { error: "Failed to update domain" },
      { status: 500 },
    );
  }
}

// DELETE /api/rubrics/domains - Delete domain
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
        { error: "Domain ID is required" },
        { status: 400 },
      );
    }

    await query(`DELETE FROM kpi_domains WHERE id = $1`, [id]);

    return NextResponse.json({ message: "Domain deleted successfully" });
  } catch (error) {
    console.error("Delete domain error:", error);
    return NextResponse.json(
      { error: "Failed to delete domain" },
      { status: 500 },
    );
  }
}
