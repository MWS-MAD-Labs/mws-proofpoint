// prisma.config.ts
import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

// `prisma generate` loads this config in CI/build contexts where a real
// DATABASE_URL may intentionally be unavailable. Generation only needs the
// schema, so use a harmless placeholder for config loading. Runtime scripts
// that actually connect to the database must still validate DATABASE_URL.
const configDatabaseUrl =
  databaseUrl ?? "postgresql://dummy:dummy@localhost:5432/dummy";

// ✅ FIX: 'migrate' tidak ada di PrismaConfig — hapus blok migrate
// Adapter dikonfigurasi via pool di runtime, bukan di config file
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    url: configDatabaseUrl,
  },
});

// ── Helper export untuk dipakai di seed files ──
export function createPool() {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not defined");
  }

  return new Pool({ connectionString: databaseUrl });
}

export function createAdapter() {
  return new PrismaPg(createPool());
}
