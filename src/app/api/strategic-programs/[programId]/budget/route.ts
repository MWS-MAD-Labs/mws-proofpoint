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
    const lines = Array.isArray(body.lines) ? body.lines : [];
    await client.query("BEGIN");
    await client.query("DELETE FROM program_budget_lines WHERE program_id = $1", [programId]);
    for (const line of lines) {
      const label = typeof line.label === "string" ? line.label.trim() : "";
      const amount = Number(line.amount_idr ?? line.amountIdr ?? 0);
      const periodId = line.period_id ?? line.periodId;
      if (!label || !periodId || !Number.isFinite(amount) || amount < 0) continue;
      await client.query("INSERT INTO program_budget_lines (id, program_id, period_id, label, description, amount_idr) VALUES ($1, $2, $3, $4, $5, $6)", [randomUUID(), programId, periodId, label, line.description ?? null, amount]);
    }
    const rows = await client.query("SELECT pbl.*, sp.label AS period_label FROM program_budget_lines pbl JOIN strategic_periods sp ON sp.id = pbl.period_id WHERE pbl.program_id = $1 ORDER BY sp.sort_order", [programId]);
    await client.query("COMMIT");
    return NextResponse.json({ data: rows.rows });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Budget update error:", error);
    return NextResponse.json({ error: "Failed to update budget" }, { status: 500 });
  } finally {
    client.release();
  }
}
