// prisma/seed.ts
// Entry point untuk `prisma db seed` & deployment
//
// Urutan eksekusi:
//   1. seedRubrics                 → rubric templates
//   2. seedSections                → sections & indicators
//   3. seedNotificationPreferences → preferences semua user aktif
//   4. seedNlsmartackObservations  → migrasi data observasi lama
//   5. seedMilestone1              → WorkflowDefinition + RoleWorkflowAssignment migration
//
// npm run db:seed            → semua seed (otomatis saat deploy)
// npm run db:seed:milestone1 → milestone 1 saja
// npm run deploy             → migrate + seed (production)

import { createPrismaClient }            from "./prisma-client.js";
import { seedRubrics }                   from "./seed-rubrics.js";
import { seedSections }                  from "./seed-sections.js";
import { seedNotificationPreferences }   from "./seed-notification-preferences.js";
import { seedNlsmartackObservations }    from "./seed-nlsmartrack-observations.js";
import { seedMilestone1 }                from "./seed-milestone1.js";

const prisma = createPrismaClient();

async function main() {
  console.log("🌱 ═══════════════════════════════════════");
  console.log("🌱  Proofpoint DB Seed — mulai...");
  console.log("🌱 ═══════════════════════════════════════");

  await seedRubrics(prisma);
  await seedSections(prisma);
  await seedNotificationPreferences(prisma);
  await seedNlsmartackObservations(prisma);
  await seedMilestone1(prisma);

  console.log("✅ ═══════════════════════════════════════");
  console.log("✅  Semua seed selesai.");
  console.log("✅ ═══════════════════════════════════════");
}

main()
  .catch((e) => { console.error("💥 Fatal error saat seeding:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());