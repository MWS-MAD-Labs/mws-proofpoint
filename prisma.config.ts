import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";
import { requireDatabaseUrl } from "./src/lib/database-url";

// Load Next.js local development settings for Prisma CLI. Existing Docker-provided
// environment variables retain precedence because dotenv does not override by default.
loadEnv({ path: ".env", quiet: true });
loadEnv({ path: ".env.local", quiet: true });

const databaseUrl = requireDatabaseUrl("for Prisma configuration");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
