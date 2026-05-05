import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { pool } from "@/lib/db";
import {
  requirePlanWriteByProgram,
  type RouteParams,
} from "@/lib/strategic-api";

async function resolveKpi(client: PoolClient, value: string) {
  const byId = await client.query(
    "SELECT k.id, kd.code || '.' || ks.code || '.' || k.code || ' ' || k.name AS label FROM kpis k JOIN kpi_standards ks ON ks.id = k.standard_id JOIN kpi_domains kd ON kd.id = ks.domain_id WHERE k.id = $1",
    [value],
  );
  if (byId.rows[0]) return byId.rows[0];
  const [domainCode, standardCode, kpiCode] = value.split(".");
  const byCode = await client.query(
    "SELECT k.id, kd.code || '.' || ks.code || '.' || k.code || ' ' || k.name AS label FROM kpis k JOIN kpi_standards ks ON ks.id = k.standard_id JOIN kpi_domains kd ON kd.id = ks.domain_id WHERE kd.code = $1 AND ks.code = $2 AND k.code = $3 LIMIT 1",
    [domainCode, standardCode, kpiCode],
  );
  return byCode.rows[0] ?? null;
}

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
    const submitted = Array.isArray(body.kpiIds)
      ? body.kpiIds
      : Array.isArray(body.links)
        ? body.links
        : [];
    await client.query("BEGIN");
    await client.query("DELETE FROM program_kpi_links WHERE program_id = $1", [
      programId,
    ]);
    const seen = new Set<string>();
    for (const entry of submitted) {
      const value =
        typeof entry === "string"
          ? entry
          : (entry.kpi_id ?? entry.kpiId ?? entry.code);
      if (typeof value !== "string") continue;
      const kpi = await resolveKpi(client, value.trim());
      if (!kpi || seen.has(kpi.id)) continue;
      seen.add(kpi.id);
      await client.query(
        "INSERT INTO program_kpi_links (id, program_id, kpi_id, coverage_label) VALUES ($1, $2, $3, $4)",
        [randomUUID(), programId, kpi.id, kpi.label],
      );
    }
    const rows = await client.query(
      "SELECT * FROM program_kpi_links WHERE program_id = $1",
      [programId],
    );
    await client.query("COMMIT");
    return NextResponse.json({ data: rows.rows });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("KPI links update error:", error);
    return NextResponse.json(
      { error: "Failed to update KPI links" },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}
