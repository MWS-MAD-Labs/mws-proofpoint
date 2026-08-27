import { spawn } from "node:child_process";
import { config as loadEnv } from "dotenv";
import pg from "pg";

loadEnv({ path: ".env", quiet: true });
loadEnv({ path: ".env.local", quiet: true });

const { Client } = pg;

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  console.error("TEST_DATABASE_URL is required for observation integration tests.");
  process.exit(1);
}

let parsed;
try {
  parsed = new URL(testDatabaseUrl);
} catch {
  console.error("TEST_DATABASE_URL must be a valid PostgreSQL URL.");
  process.exit(1);
}

const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
const hostname = parsed.hostname.toLowerCase();
const unsafeHostPattern = /(^|[.-])(prod|production|stage|staging)([.-]|$)/;
if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
  console.error("TEST_DATABASE_URL must use the PostgreSQL protocol.");
  process.exit(1);
}
if (!databaseName.endsWith("_test")) {
  console.error("Refusing to run: the integration database name must end with '_test'.");
  process.exit(1);
}
if (unsafeHostPattern.test(hostname)) {
  console.error("Refusing to run against a production or staging hostname.");
  process.exit(1);
}
if (process.env.DATABASE_URL) {
  // Never reset the primary application database, regardless of its environment.
  const primary = new URL(process.env.DATABASE_URL);
  const primaryName = decodeURIComponent(primary.pathname.replace(/^\//, ""));
  if (primaryName === databaseName || process.env.DATABASE_URL === testDatabaseUrl) {
    console.error("Refusing to run against the primary application database.");
    process.exit(1);
  }
}

const adminUrl = new URL(testDatabaseUrl);
adminUrl.pathname = "/postgres";
adminUrl.search = "";
const adminClient = new Client({ connectionString: adminUrl.toString() });
try {
  await adminClient.connect();
  const exists = await adminClient.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    [databaseName],
  );
  if (exists.rowCount === 0) {
    const escapedDatabaseName = databaseName.replace(/"/g, '""');
    await adminClient.query(`CREATE DATABASE "${escapedDatabaseName}"`);
  }
} catch (error) {
  console.error("Unable to create or inspect the isolated test database.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
} finally {
  await adminClient.end().catch(() => undefined);
}

const childEnvironment = {
  ...process.env,
  NODE_ENV: "test",
  DATABASE_URL: testDatabaseUrl,
};

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", env: childEnvironment });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) reject(new Error(`${command} terminated by ${signal}`));
      else if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code ?? 1}`));
    });
  });
}

try {
  await run(process.platform === "win32" ? "npx.cmd" : "npx", [
    "prisma",
    "migrate",
    "reset",
    "--force",
  ]);
  await run(process.execPath, [
    "--import",
    "tsx",
    "--test",
    "src/features/observations/server/observation-api.integration-test.ts",
  ]);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
