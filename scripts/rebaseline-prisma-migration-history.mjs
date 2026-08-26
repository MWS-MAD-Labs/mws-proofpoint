import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { config as loadEnv } from "dotenv";
import { Pool } from "pg";

loadEnv({ path: ".env" });
loadEnv({ path: ".env.local" });

const BASELINE_MIGRATION = "20260812000000_existing_database_baseline";
const CONFIRMATION = `rebaseline-${BASELINE_MIGRATION}`;
const FORWARD_MIGRATIONS = new Set([
  "20260824000000_observation_acknowledgement_automation",
  "20260826000000_observation_notification_settings",
  "20260827000000_observation_scheduler_observability",
]);
const REQUIRED_TABLES = [
  "users",
  "departments",
  "rubric_templates",
  "assessments",
  "observations",
  "observation_answers",
  "observation_updates",
  "notification_preferences",
  "strategic_plans",
  "department_roles",
  "department_role_memberships",
];
const BASELINE_PATH = new URL(
  `../prisma/migrations/${BASELINE_MIGRATION}/migration.sql`,
  import.meta.url,
);

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required for migration-history rebaseline.");
  process.exit(1);
}

if (process.env.MIGRATION_HISTORY_REBASE_CONFIRM !== CONFIRMATION) {
  console.error(
    `Refusing to change migration metadata. Set MIGRATION_HISTORY_REBASE_CONFIRM=${CONFIRMATION} after taking and verifying a database backup.`,
  );
  process.exit(1);
}

const baselineSql = await readFile(BASELINE_PATH);
const baselineChecksum = createHash("sha256").update(baselineSql).digest("hex");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const client = await pool.connect();

try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock($1, $2)", [1_347_436_354, 1_929_472_801]);

  const migrationTable = await client.query(
    `SELECT to_regclass('public._prisma_migrations')::text AS name`,
  );
  if (!migrationTable.rows[0]?.name) {
    throw new Error("_prisma_migrations does not exist; this command is only for existing ProofPoint databases.");
  }

  const failedMigrations = await client.query(
    `SELECT migration_name
       FROM _prisma_migrations
      WHERE finished_at IS NULL
        AND rolled_back_at IS NULL
      ORDER BY started_at`,
  );
  if (failedMigrations.rowCount > 0) {
    throw new Error(
      `Active failed migrations must be resolved first: ${failedMigrations.rows
        .map((row) => row.migration_name)
        .join(", ")}`,
    );
  }

  const tableCheck = await client.query(
    `SELECT required.table_name,
            to_regclass('public.' || required.table_name)::text AS existing_table
       FROM unnest($1::text[]) AS required(table_name)
      ORDER BY required.table_name`,
    [REQUIRED_TABLES],
  );
  const missingTables = tableCheck.rows
    .filter((row) => !row.existing_table)
    .map((row) => row.table_name);
  if (missingTables.length > 0) {
    throw new Error(
      `Database is older than the verified baseline; missing required tables: ${missingTables.join(", ")}`,
    );
  }

  const idTypes = await client.query(
    `SELECT table_name, data_type
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND column_name = 'id'
        AND table_name = ANY($1::text[])`,
    [["users", "departments", "rubric_templates", "observations"]],
  );
  const invalidIdTypes = idTypes.rows.filter((row) => row.data_type !== "uuid");
  if (invalidIdTypes.length > 0 || idTypes.rowCount !== 4) {
    throw new Error(
      `Verified baseline requires UUID primary identifiers; found: ${idTypes.rows
        .map((row) => `${row.table_name}.${row.data_type}`)
        .join(", ")}`,
    );
  }

  const currentMigrations = await client.query(
    `SELECT migration_name, checksum, finished_at, rolled_back_at
       FROM _prisma_migrations
      ORDER BY started_at, migration_name`,
  );
  const baselineRecord = currentMigrations.rows.find(
    (row) =>
      row.migration_name === BASELINE_MIGRATION &&
      row.finished_at &&
      !row.rolled_back_at,
  );

  if (baselineRecord) {
    if (baselineRecord.checksum !== baselineChecksum) {
      throw new Error("The existing applied baseline migration record has a different checksum.");
    }
    console.log(`${BASELINE_MIGRATION} is already recorded with the expected checksum.`);
    await client.query("COMMIT");
    process.exitCode = 0;
  } else {
    const preserved = currentMigrations.rows
      .filter((row) => FORWARD_MIGRATIONS.has(row.migration_name))
      .map((row) => row.migration_name);
    const superseded = currentMigrations.rows
      .filter((row) => !FORWARD_MIGRATIONS.has(row.migration_name))
      .map((row) => row.migration_name);

    console.log(`Superseding ${superseded.length} historical migration records.`);
    console.log(`Preserving forward migration records: ${preserved.join(", ") || "none"}.`);

    await client.query(
      `DELETE FROM _prisma_migrations
        WHERE migration_name <> ALL($1::text[])`,
      [Array.from(FORWARD_MIGRATIONS)],
    );
    await client.query(
      `INSERT INTO _prisma_migrations
         (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
       VALUES (gen_random_uuid()::text, $1, CURRENT_TIMESTAMP, $2, NULL, NULL, CURRENT_TIMESTAMP, 0)`,
      [baselineChecksum, BASELINE_MIGRATION],
    );

    await client.query("COMMIT");
    console.log(`Recorded ${BASELINE_MIGRATION} with checksum ${baselineChecksum}.`);
    console.log("Run `npm run db:migrate:deploy` next to apply any pending forward migrations.");
  }
} catch (error) {
  await client.query("ROLLBACK");
  console.error("Migration-history rebaseline failed:", error);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
