import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { randomUUID } from "node:crypto";
import { pool, query } from "@/lib/db";
import { observationListQuerySchema } from "../schemas";
import type { ObservationActor } from "../types";
import { queryObservationList, queryObservationSummary } from "./queries";

const OBSERVATION_COUNT = 1_000;
const INDICATOR_COUNT = 200;
const LIST_BUDGET_MS = 1_500;
const SUMMARY_BUDGET_MS = 1_500;
const DETAIL_QUERY_BUDGET_MS = 1_000;

async function timed<T>(label: string, budgetMs: number, work: () => Promise<T>) {
  const started = performance.now();
  const result = await work();
  const duration = performance.now() - started;
  console.log(`${label}: ${duration.toFixed(1)}ms (budget ${budgetMs}ms)`);
  assert.ok(duration <= budgetMs, `${label} exceeded ${budgetMs}ms`);
  return result;
}

async function main() {
  const prefix = `observation-perf-${randomUUID()}`;
  const departmentId = randomUUID();
  const managerId = randomUUID();
  const staffId = randomUUID();
  const rubricId = randomUUID();
  const sectionId = randomUUID();
  const observationIds = Array.from({ length: OBSERVATION_COUNT }, () => randomUUID());
  const indicatorIds = Array.from({ length: INDICATOR_COUNT }, () => randomUUID());
  const actor: ObservationActor = { id: managerId, roles: ["manager"] };

  try {
    await query(
      `INSERT INTO departments (id, name, created_at, updated_at)
       VALUES ($1, $2, NOW(), NOW())`,
      [departmentId, `${prefix}-department`],
    );
    for (const [id, role] of [[managerId, "manager"], [staffId, "staff"]] as const) {
      const email = `${prefix}-${role}@example.test`;
      await query(
        `INSERT INTO users
           (id, email, password_hash, email_verified, status, created_at, updated_at)
         VALUES ($1, $2, 'performance-check', true, 'active', NOW(), NOW())`,
        [id, email],
      );
      await query(
        `INSERT INTO profiles
           (id, user_id, email, full_name, department_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
        [randomUUID(), id, email, `${prefix}-${role}`, departmentId],
      );
      await query(`INSERT INTO user_roles (id, user_id, role) VALUES ($1, $2, $3)`, [
        randomUUID(),
        id,
        role,
      ]);
    }
    await query(
      `INSERT INTO rubric_templates
         (id, name, description, department_id, is_global, is_active, created_by,
          created_at, updated_at, template_type)
       VALUES ($1, $2, $3, $4, false, true, $5, NOW(), NOW(), 'CLASSROOM_OBSERVATION')`,
      [rubricId, `${prefix}-rubric`, "Performance fixture", departmentId, managerId],
    );
    await query(
      `INSERT INTO rubric_sections (id, template_id, name, weight, sort_order, created_at)
       VALUES ($1, $2, $3, 100, 0, NOW())`,
      [sectionId, rubricId, `${prefix}-section`],
    );

    const indicatorValues: unknown[] = [];
    const indicatorPlaceholders = indicatorIds.map((id, index) => {
      const offset = indicatorValues.length;
      indicatorValues.push(id, sectionId, `${prefix}-indicator-${index}`, index);
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, 'SCALE', true, NOW())`;
    });
    await query(
      `INSERT INTO rubric_indicators
         (id, section_id, name, sort_order, question_type, is_required, created_at)
       VALUES ${indicatorPlaceholders.join(",")}`,
      indicatorValues,
    );

    for (let start = 0; start < observationIds.length; start += 100) {
      const batch = observationIds.slice(start, start + 100);
      const values: unknown[] = [];
      const placeholders = batch.map((id, index) => {
        const offset = values.length;
        const status = index % 3 === 0 ? "draft" : index % 3 === 1 ? "submitted" : "acknowledged";
        values.push(id, staffId, managerId, rubricId, status, `${prefix}-${start + index}`);
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, 'MANAGER', $${offset + 6}, NOW(), NOW(), NOW() + INTERVAL '7 days')`;
      });
      await query(
        `INSERT INTO observations
           (id, "staffId", "managerId", template_id, status, type, title,
            created_at, updated_at, due_at)
         VALUES ${placeholders.join(",")}`,
        values,
      );
    }

    const largeObservationId = observationIds[0]!;
    const answerValues: unknown[] = [];
    const answerPlaceholders = indicatorIds.map((indicatorId) => {
      const offset = answerValues.length;
      answerValues.push(randomUUID(), largeObservationId, indicatorId);
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, 80, 'performance', NOW(), NOW())`;
    });
    await query(
      `INSERT INTO observation_answers
         (id, observation_id, indicator_id, score, note, created_at, updated_at)
       VALUES ${answerPlaceholders.join(",")}`,
      answerValues,
    );

    await timed("Filtered paginated list", LIST_BUDGET_MS, () =>
      queryObservationList(
        actor,
        observationListQuerySchema.parse({
          q: prefix,
          status: "draft",
          page: 1,
          pageSize: 50,
          sort: "updated_desc",
        }),
      ),
    );
    await timed("Observation summary", SUMMARY_BUDGET_MS, () => queryObservationSummary(actor));
    await timed("Large rubric detail query", DETAIL_QUERY_BUDGET_MS, () =>
      query(
        `SELECT ri.id, ri.name, ri.question_type, ri.is_required,
                oa.score, oa.note, oa.updated_at
         FROM rubric_sections rs
         JOIN rubric_indicators ri ON ri.section_id = rs.id
         LEFT JOIN observation_answers oa
           ON oa.observation_id = $1 AND oa.indicator_id = ri.id
         WHERE rs.template_id = $2
         ORDER BY rs.sort_order, ri.sort_order`,
        [largeObservationId, rubricId],
      ),
    );

    const plan = await query<{ "QUERY PLAN": string }>(
      `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
       SELECT id FROM observations
       WHERE "managerId" = $1 AND status = 'draft'
       ORDER BY updated_at DESC
       LIMIT 50`,
      [managerId],
    );
    console.log("Query plan for manager draft list:");
    console.log(plan.map((row) => row["QUERY PLAN"]).join("\n"));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
