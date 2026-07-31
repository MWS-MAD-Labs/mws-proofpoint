import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Load Next.js local development settings for Prisma CLI. Existing Docker-provided
// environment variables retain precedence because dotenv does not override by default.
loadEnv({ path: ".env" });
loadEnv({ path: ".env.local" });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for Prisma configuration.");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
