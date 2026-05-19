import { Pool } from "pg";

const migrationName = "20260501000000_add_workflow_definitions";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required for migration repair.");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  const failed = await pool.query(
    `SELECT migration_name
       FROM _prisma_migrations
      WHERE migration_name = $1
        AND finished_at IS NULL
        AND rolled_back_at IS NULL
      LIMIT 1`,
    [migrationName],
  );

  if (failed.rowCount === 0) {
    console.log(`No active failed record found for ${migrationName}.`);
    process.exit(0);
  }

  console.log(`Found failed migration ${migrationName}; cleaning partial objects before rollback.`);

  await pool.query(`
    DROP TABLE IF EXISTS "role_workflow_assignments" CASCADE;
    DROP TABLE IF EXISTS "workflow_steps" CASCADE;
    DROP TABLE IF EXISTS "workflow_definitions" CASCADE;
  `);

  console.log(`Partial objects for ${migrationName} cleaned.`);
} catch (error) {
  console.error(`Failed to repair ${migrationName}:`, error);
  process.exit(1);
} finally {
  await pool.end();
}
