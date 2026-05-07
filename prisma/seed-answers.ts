// prisma/seed-answers.ts
// Membuat answers untuk observations yang belum punya answers
// Standalone : npx tsx prisma/seed-answers.ts

import "dotenv/config";
import { PrismaPg }     from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool }         from "pg";


async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL tidak ditemukan di environment.");
  }

  const pool    = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma  = new PrismaClient({ adapter } as never);

  console.log("🚀 Membuat answers untuk observations yang belum punya answers...\n");

  // ✅ FIX: rubric → rubric_templates (nama relasi di schema production)
  //         answers → answers (sudah benar, tapi perlu include eksplisit)
  const observations = await prisma.observation.findMany({
    include: {
      rubric_templates: {
        include: {
          sections: {
            include: { indicators: true }
          }
        }
      },
      answers: true,
    },
  });

  let fixed = 0;
  for (const obs of observations) {
    // ✅ FIX: obs.rubric_templates (bukan obs.rubric)
    const allIndicatorIds = obs.rubric_templates.sections.flatMap(
      (s) => s.indicators.map((i) => i.id)
    );
    const existingIds = new Set(obs.answers.map((a) => a.indicatorId));
    const missing     = allIndicatorIds.filter((id) => !existingIds.has(id));

    if (missing.length > 0) {
      await prisma.observationAnswer.createMany({
        data: missing.map((indicatorId) => ({
          id:            crypto.randomUUID(), // ✅ FIX: id wajib diisi (tanpa @default di schema)
          observationId: obs.id,
          indicatorId,
          score:         0,
          note:          "",
        })),
        skipDuplicates: true,
      });
      console.log(`✅ Obs ${obs.id}: +${missing.length} answers`);
      fixed++;
    }
  }

  console.log(`\n🎉 Selesai! ${fixed} observation diperbaiki.`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });

// ── Standalone runner check (untuk konsistensi) ──
export {};