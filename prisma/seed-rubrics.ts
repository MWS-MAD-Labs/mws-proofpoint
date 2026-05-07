// prisma/seed-rubrics.ts
// Standalone: npx tsx prisma/seed-rubrics.ts
// Via seed.ts: import { seedRubrics } from "./seed-rubrics.js"

import { PrismaClient } from "@prisma/client";
import { createPrismaClient } from "./prisma-client.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);

const RUBRICS: { name: string; description: string; isGlobal: boolean }[] = [
  { name: "DETAILED CLASSROOM OBSERVATION",                   description: "Detailed observation of classroom teaching and learning activities",          isGlobal: true  },
  { name: "CHECKLIST FOR DIRECT INSTRUCTION",                 description: "Checklist for direct instruction in learning",                               isGlobal: true  },
  { name: "Special Education Teacher Supervision Instrument", description: "Supervision instrument for special education teachers",                       isGlobal: true  },
  { name: "CHECKLIST FOR LEARNING AND UNDERSTANDING",         description: "Checklist for student learning and understanding",                           isGlobal: true  },
  { name: "FOCUS ON LEARNERS – STUDENT ENGAGEMENT",           description: "Focus on student engagement in learning",                                    isGlobal: true  },
  { name: "CHECKLIST FOR DIFFERENTIATION",                    description: "Checklist for differentiated learning",                                      isGlobal: true  },
  { name: "FOCUS ON LEARNERS – SMALL GROUP OR IN PAIRING",    description: "Focus on small group or paired learning",                                   isGlobal: true  },
  { name: "CLASSROOM DISPLAY CHECKLIST",                      description: "Checklist for classroom display and arrangement",                            isGlobal: true  },
  { name: "Lesson Preparation Walkthrough",                   description: "Walkthrough for lesson preparation",                                         isGlobal: true  },
  { name: "DELIVERY OF INSTRUCTION",                          description: "Observation of instructional delivery",                                      isGlobal: true  },
  { name: "Test Observation", description: "Observation for testing purposes",                    isGlobal: false },
  { name: "obstest",          description: "Rubric for observation testing",                      isGlobal: false },
  { name: "obsertvertest",    description: "Rubric for observation testing (alternative)",        isGlobal: false },
];

export async function seedRubrics(prisma: PrismaClient): Promise<void> {
  console.log("\n📚 [seed-rubrics] Seeding rubric templates...\n");

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
  console.log(`\n🎉 [seed-rubrics] Done!`);
  console.log(`   ✅ Created  : ${successCount}`);
  console.log(`   ⏭️  Existed  : ${existingCount}`);
  console.log(`   ❌ Errors   : ${errorCount}`);
  console.log(`   Total rubrics in DB: ${total}\n`);
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