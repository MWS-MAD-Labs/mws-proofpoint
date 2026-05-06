// prisma/seed-rubrics.ts
// Standalone : npx tsx prisma/seed-rubrics.ts
// Via seed.ts : import { seedRubrics } from "./seed-rubrics.js"

import { PrismaClient } from "@prisma/client";
import { createPrismaClient } from "./prisma-client.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);

const RUBRICS: { name: string; description: string; isGlobal: boolean }[] = [
  { name: "DETAILED CLASSROOM OBSERVATION",                   description: "Observasi detail untuk kegiatan belajar mengajar di kelas",    isGlobal: true  },
  { name: "CHECKLIST FOR DIRECT INSTRUCTION",                 description: "Checklist untuk instruksi langsung dalam pembelajaran",        isGlobal: true  },
  { name: "Special Education Teacher Supervision Instrument", description: "Instrumen supervisi untuk guru pendidikan khusus",             isGlobal: true  },
  { name: "CHECKLIST FOR LEARNING AND UNDERSTANDING",         description: "Checklist untuk pembelajaran dan pemahaman siswa",            isGlobal: true  },
  { name: "FOCUS ON LEARNERS – STUDENT ENGAGEMENT",           description: "Fokus pada keterlibatan siswa dalam pembelajaran",            isGlobal: true  },
  { name: "CHECKLIST FOR DIFFERENTIATION",                    description: "Checklist untuk diferensiasi pembelajaran",                   isGlobal: true  },
  { name: "FOCUS ON LEARNERS – SMALL GROUP OR IN PAIRING",    description: "Fokus pada pembelajaran kelompok kecil atau berpasangan",     isGlobal: true  },
  { name: "CLASSROOM DISPLAY CHECKLIST",                      description: "Checklist untuk display/penataan ruang kelas",                isGlobal: true  },
  { name: "Lesson Preparation Walkthrough",                   description: "Walkthrough persiapan pembelajaran",                          isGlobal: true  },
  { name: "DELIVERY OF INSTRUCTION",                          description: "Observasi penyampaian instruksi pembelajaran",                isGlobal: true  },
  { name: "Test Observation", description: "Observasi untuk testing",                      isGlobal: false },
  { name: "obstest",          description: "Rubric untuk testing observasi",               isGlobal: false },
  { name: "obsertvertest",    description: "Rubric untuk testing observasi (alternatif)",  isGlobal: false },
];

export async function seedRubrics(prisma: PrismaClient): Promise<void> {
  console.log("\n📚 [seed-rubrics] Mulai seeding rubric templates...\n");

  let successCount  = 0;
  let existingCount = 0;
  let errorCount    = 0;

  for (const rubric of RUBRICS) {
    try {
      const existing = await prisma.rubricTemplate.findFirst({
        where: { name: rubric.name },
      });

      if (!existing) {
        await prisma.rubricTemplate.create({
          data: {
            name:         rubric.name,
            description:  rubric.description,
            isGlobal:     rubric.isGlobal,
            templateType: "CLASSROOM_OBSERVATION",
          },
        });
        console.log(`✅ Created : ${rubric.name}`);
        successCount++;
      } else {
        console.log(`⏭️  Exists  : ${rubric.name}`);
        existingCount++;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`❌ Failed  : ${rubric.name} — ${message}`);
      errorCount++;
    }
  }

  const total = await prisma.rubricTemplate.count();
  console.log(`\n🎉 [seed-rubrics] Selesai!`);
  console.log(`   ✅ Dibuat    : ${successCount}`);
  console.log(`   ⏭️  Sudah ada : ${existingCount}`);
  console.log(`   ❌ Error     : ${errorCount}`);
  console.log(`   Total rubrics di DB: ${total}\n`);
}

// ── Standalone runner ──
const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);

if (isMain) {
  const prisma = createPrismaClient();
  seedRubrics(prisma)
    .catch((e) => { console.error("💥 Fatal error:", e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}