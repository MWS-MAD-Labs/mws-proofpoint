import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import {
  requirePlanWriteByProgram,
  type RouteParams,
} from "@/lib/strategic-api";

export async function PUT(
  request: Request,
  { params }: RouteParams<{ programId: string }>,
) {
  const client = await pool.connect();
  try {
    const { programId } = await params;
    const guard = await requirePlanWriteByProgram(programId);
    if ("error" in guard) return guard.error;
    const body = await request.json();
    const departmentIds = Array.isArray(body.departmentIds)
      ? body.departmentIds
      : [];
    const uniqueIds = [
      ...new Set(departmentIds.filter((id: unknown) => typeof id === "string")),
    ] as string[];
    const plan = (guard as { plan: { department_id: string } }).plan;
    if (uniqueIds.includes(plan.department_id))
      return NextResponse.json(
        { error: "Owner department cannot be a collaborator" },
        { status: 400 },
      );
    await client.query("BEGIN");
    await client.query(
      "DELETE FROM program_collaborators WHERE program_id = $1",
      [programId],
    );
    for (const departmentId of uniqueIds)
      await client.query(
        "INSERT INTO program_collaborators (id, program_id, department_id) VALUES ($1, $2, $3)",
        [randomUUID(), programId, departmentId],
      );
    const rows = await client.query(
      "SELECT pc.*, d.name AS department_name FROM program_collaborators pc JOIN departments d ON d.id = pc.department_id WHERE pc.program_id = $1",
      [programId],
    );
    await client.query("COMMIT");
    return NextResponse.json({ data: rows.rows });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Collaborators update error:", error);
    return NextResponse.json(
      { error: "Failed to update collaborators" },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}
