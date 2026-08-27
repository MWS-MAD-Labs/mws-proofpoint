import { spawnSync } from "node:child_process";
import { Pool } from "pg";

const migrationName = "20260501000000_add_workflow_definitions";
const baselineMigration = "20260812000000_existing_database_baseline";
const baselineConfirmation = `rebaseline-${baselineMigration}`;
const allowedIdTypes = new Set(["text", "uuid"]);

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required for migration repair.");
  process.exit(1);
}

function run(command, args, environment = process.env) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: false,
    env: environment,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function getColumnType(pool, tableName, columnName) {
  const result = await pool.query(
    `SELECT format_type(a.atttypid, a.atttypmod) AS data_type
       FROM pg_attribute a
       JOIN pg_class c ON c.oid = a.attrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = current_schema()
        AND c.relname = $1
        AND a.attname = $2
        AND NOT a.attisdropped
      LIMIT 1`,
    [tableName, columnName],
  );

  const dataType = result.rows[0]?.data_type;
  if (!allowedIdTypes.has(dataType)) {
    throw new Error(
      `Unsupported ${tableName}.${columnName} type: ${dataType ?? "not found"}`,
    );
  }
  return dataType;
}

async function applyWorkflowDefinitionsMigration(pool) {
  const departmentRoleIdType = await getColumnType(
    pool,
    "department_roles",
    "id",
  );
  const rubricTemplateIdType = await getColumnType(
    pool,
    "rubric_templates",
    "id",
  );

  console.log(
    `Applying ${migrationName} manually using department_roles.id=${departmentRoleIdType}, rubric_templates.id=${rubricTemplateIdType}.`,
  );

  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";

    DO $$ BEGIN
      CREATE TYPE "TemplateType" AS ENUM (
        'KPI_APPRAISAL',
        'CLASSROOM_OBSERVATION',
        'GENERIC'
      );
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "WorkflowActionType" AS ENUM (
        'FILL_FORM',
        'ACKNOWLEDGE',
        'REVIEW',
        'APPROVE'
      );
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    ALTER TABLE "rubric_templates"
    ADD COLUMN IF NOT EXISTS "template_type" "TemplateType" NOT NULL DEFAULT 'KPI_APPRAISAL';

    CREATE TABLE IF NOT EXISTS "workflow_definitions" (
      "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
      "name" TEXT NOT NULL,
      "type" "TemplateType" NOT NULL,
      "description" TEXT,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "workflow_definitions_pkey" PRIMARY KEY ("id")
    );

    CREATE TABLE IF NOT EXISTS "workflow_steps" (
      "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
      "workflow_id" TEXT NOT NULL,
      "step_order" INTEGER NOT NULL,
      "actor_role" "AppRole" NOT NULL,
      "action_type" "WorkflowActionType" NOT NULL,
      "description" TEXT,
      CONSTRAINT "workflow_steps_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "workflow_steps_workflow_id_fkey"
        FOREIGN KEY ("workflow_id")
        REFERENCES "workflow_definitions"("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE
    );

    CREATE INDEX IF NOT EXISTS "workflow_steps_workflow_id_idx"
      ON "workflow_steps"("workflow_id");
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS "role_workflow_assignments" (
      "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
      "department_role_id" ${departmentRoleIdType} NOT NULL,
      "workflow_id" TEXT NOT NULL,
      "rubric_id" ${rubricTemplateIdType},
      "is_active" BOOLEAN NOT NULL DEFAULT true,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "role_workflow_assignments_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "role_workflow_assignments_dept_role_fkey"
        FOREIGN KEY ("department_role_id")
        REFERENCES "department_roles"("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE,
      CONSTRAINT "role_workflow_assignments_workflow_fkey"
        FOREIGN KEY ("workflow_id")
        REFERENCES "workflow_definitions"("id")
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
      CONSTRAINT "role_workflow_assignments_rubric_fkey"
        FOREIGN KEY ("rubric_id")
        REFERENCES "rubric_templates"("id")
        ON DELETE SET NULL
        ON UPDATE CASCADE
    );

    CREATE INDEX IF NOT EXISTS "role_workflow_assignments_dept_role_idx"
      ON "role_workflow_assignments"("department_role_id");

    CREATE INDEX IF NOT EXISTS "role_workflow_assignments_workflow_idx"
      ON "role_workflow_assignments"("workflow_id");

    CREATE INDEX IF NOT EXISTS "role_workflow_assignments_rubric_idx"
      ON "role_workflow_assignments"("rubric_id");
  `);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  const activeFailures = await pool.query(
    `SELECT migration_name
       FROM _prisma_migrations
      WHERE finished_at IS NULL
        AND rolled_back_at IS NULL
      ORDER BY started_at`,
  );
  const activeFailureNames = activeFailures.rows.map(
    (row) => row.migration_name,
  );

  if (activeFailureNames.includes(baselineMigration)) {
    if (
      activeFailureNames.length !== 1 ||
      activeFailureNames[0] !== baselineMigration
    ) {
      throw new Error(
        `Cannot recover ${baselineMigration} while other active failed migrations exist: ${activeFailureNames.join(", ")}`,
      );
    }

    console.log(
      `Found failed baseline attempt ${baselineMigration}; marking that attempt rolled back before guarded rebaseline.`,
    );
    run("prisma", [
      "migrate",
      "resolve",
      "--rolled-back",
      baselineMigration,
    ]);
    run(
      process.execPath,
      ["/app/scripts/rebaseline-prisma-migration-history.mjs"],
      {
        ...process.env,
        MIGRATION_HISTORY_REBASE_CONFIRM: baselineConfirmation,
      },
    );
    console.log(
      `Recovered migration history at ${baselineMigration}; startup will retry forward migrations.`,
    );
    process.exit(0);
  }

  if (!activeFailureNames.includes(migrationName)) {
    console.log(`No recoverable active failed migration found.`);
    process.exit(0);
  }

  if (activeFailureNames.length !== 1) {
    throw new Error(
      `Cannot recover ${migrationName} while other active failed migrations exist: ${activeFailureNames.join(", ")}`,
    );
  }

  console.log(
    `Found failed migration ${migrationName}; cleaning partial objects.`,
  );

  await pool.query(`
    DROP TABLE IF EXISTS "role_workflow_assignments" CASCADE;
    DROP TABLE IF EXISTS "workflow_steps" CASCADE;
    DROP TABLE IF EXISTS "workflow_definitions" CASCADE;
  `);

  await applyWorkflowDefinitionsMigration(pool);

  console.log(
    `Marking ${migrationName} as applied in Prisma migration history.`,
  );
  run("npx", ["prisma", "migrate", "resolve", "--applied", migrationName]);
} catch (error) {
  console.error(`Failed to repair ${migrationName}:`, error);
  process.exit(1);
} finally {
  await pool.end();
}
