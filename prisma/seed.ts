// prisma/seed.ts
// Entry point for `prisma db seed` & deployment
//
// Execution order:
//   1. seedRubrics                 → rubric templates
//   2. seedSections                → sections & indicators
//   3. seedNotificationPreferences → preferences for all active users
//   4. seedNlsmartackObservations  → migrate legacy observation data
//   5. seedMilestone1              → WorkflowDefinition + RoleWorkflowAssignment migration
//
// npm run db:seed            → run all seeds (automatic on deploy)
// npm run db:seed:milestone1 → milestone 1 only
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
  console.log("🌱  Proofpoint DB Seed — starting...");
  console.log("🌱 ═══════════════════════════════════════");

  await seedRubrics(prisma);
  await seedSections(prisma);
  await seedNotificationPreferences(prisma);
  await seedNlsmartackObservations(prisma);
  await seedMilestone1(prisma);

  console.log("✅ ═══════════════════════════════════════");
  console.log("✅  All seeds completed.");
  console.log("✅ ═══════════════════════════════════════");
}

main()
  .catch((e) => { console.error("💥 Fatal error during seeding:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());