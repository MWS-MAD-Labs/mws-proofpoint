import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requirePlanWriteByProgram, type RouteParams } from "@/lib/strategic-api";

export async function PUT(request: Request, { params }: RouteParams<{ programId: string }>) {
  const client = await pool.connect();
  try {
    const { programId } = await params;
    const guard = await requirePlanWriteByProgram(programId);
    if ("error" in guard) return guard.error;
    const body = await request.json();
    const items = Array.isArray(body.items) ? body.items : [];
    await client.query("BEGIN");
    await client.query("DELETE FROM program_checklist_items WHERE program_id = $1", [programId]);
    for (const [index, item] of items.entries()) {
      const text = typeof item.text === "string" ? item.text.trim() : "";
      if (!text) continue;
      await client.query("INSERT INTO program_checklist_items (id, program_id, text, done, sort_order) VALUES ($1, $2, $3, $4, $5)", [randomUUID(), programId, text, Boolean(item.done), index + 1]);
    }
    const rows = await client.query("SELECT * FROM program_checklist_items WHERE program_id = $1 ORDER BY sort_order", [programId]);
    await client.query("COMMIT");
    return NextResponse.json({ data: rows.rows });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Checklist update error:", error);
    return NextResponse.json({ error: "Failed to update checklist" }, { status: 500 });
  } finally {
    client.release();
  }
}
