// prisma.config.ts
import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not defined");
}

// ✅ FIX: 'migrate' tidak ada di PrismaConfig — hapus blok migrate
// Adapter dikonfigurasi via pool di runtime, bukan di config file
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    url: databaseUrl,
  },
});

// ── Helper export untuk dipakai di seed files ──
export function createPool() {
  return new Pool({ connectionString: databaseUrl });
}

export function createAdapter() {
  return new PrismaPg(createPool());
}