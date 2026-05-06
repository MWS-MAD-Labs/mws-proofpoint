// prisma/seed.ts
// Entry point untuk `prisma db seed` & deployment
// npm run db:seed       → semua seed
// npm run deploy        → migrate + seed

import { createPrismaClient }            from "./prisma-client.js";
import { seedRubrics }                   from "./seed-rubrics.js";
import { seedSections }                  from "./seed-sections.js";
import { seedNotificationPreferences }   from "./seed-notification-preferences.js";
import { seedNlsmartackObservations }    from "./seed-nlsmartrack-observations.js";

const prisma = createPrismaClient();

async function main() {
  console.log("🌱 ═══════════════════════════════════════");
  console.log("🌱  Proofpoint DB Seed — mulai...");
  console.log("🌱 ═══════════════════════════════════════");

  await seedRubrics(prisma);
  await seedSections(prisma);
  await seedNotificationPreferences(prisma);
  await seedNlsmartackObservations(prisma);

  console.log("✅ ═══════════════════════════════════════");
  console.log("✅  Semua seed selesai.");
  console.log("✅ ═══════════════════════════════════════");
}

main()
  .catch((e) => { console.error("💥 Fatal error saat seeding:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());