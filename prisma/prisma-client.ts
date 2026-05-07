// prisma/prisma-client.ts
// Helper untuk inisialisasi PrismaClient dengan pg adapter
// Prisma v7 di ESM wajib pakai adapter — tidak bisa new PrismaClient() kosong
//
// Dipakai oleh semua seed file:
//   import { createPrismaClient } from "./prisma-client.js"

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg }     from "@prisma/adapter-pg";
import { Pool }         from "pg";

export function createPrismaClient(): PrismaClient {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL tidak ditemukan di environment.\n" +
      "Pastikan file .env ada dan berisi DATABASE_URL yang valid."
    );
  }

  const pool    = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({ adapter } as any);
}