import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requirePlanWriteByProgram, type RouteParams } from "@/lib/strategic-api";
import { validProgramStatus } from "@/lib/strategic-plans";

export async function POST(request: Request, { params }: RouteParams<{ programId: string }>) {
  const client = await pool.connect();
  try {
    const { programId } = await params;
    const guard = await requirePlanWriteByProgram(programId);
    if ("error" in guard) return guard.error;
    const body = await request.json();
    const note = typeof body.note === "string" ? body.note.trim() : "";
    if (!note || !validProgramStatus(body.status)) return NextResponse.json({ error: "note and valid status are required" }, { status: 400 });
    await client.query("BEGIN");
    const update = await client.query("INSERT INTO program_progress_updates (id, program_id, author_id, note, status) VALUES ($1, $2, $3, $4, $5) RETURNING *", [randomUUID(), programId, guard.user.id, note, body.status]);
    await client.query("UPDATE strategic_programs SET status = $1::\"ProgramStatus\", updated_at = now() WHERE id = $2", [body.status, programId]);
    await client.query("COMMIT");
    return NextResponse.json({ data: update.rows[0] }, { status: 201 });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Progress update error:", error);
    return NextResponse.json({ error: "Failed to add progress update" }, { status: 500 });
  } finally {
    client.release();
  }
}
