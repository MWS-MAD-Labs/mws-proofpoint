// prisma/seed-notification-preferences.ts
// Standalone : npx tsx prisma/seed-notification-preferences.ts
// Via seed.ts : import { seedNotificationPreferences } from "./seed-notification-preferences.js"

import { PrismaClient } from "@prisma/client";
import { createPrismaClient } from "./prisma-client.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);

export async function seedNotificationPreferences(prisma: PrismaClient): Promise<void> {
  console.log("\n🔔 [seed-notification-preferences] Mulai seeding...\n");

  const activeUsers = await prisma.user.findMany({
    where:  { status: "active" },
    select: { id: true },
  });

  console.log(`📋 Ditemukan ${activeUsers.length} user aktif`);

  let successCount = 0;
  let errorCount   = 0;

  for (const user of activeUsers) {
    try {
      // ✅ FIX: Hapus assignment ke `result` yang tidak dipakai — langsung await tanpa assign
      await prisma.notificationPreference.upsert({
        where:  { userId: user.id },
        update: {},
        create: {
          userId:                 user.id,
          emailEnabled:           true,
          assessmentSubmitted:    true,
          managerReviewDone:      true,
          directorApproved:       true,
          adminReleased:          true,
          assessmentReturned:     true,
          assessmentAcknowledged: true,
        },
      });
      successCount++;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`❌ Error user ${user.id}: ${message}`);
      errorCount++;
    }
  }

  const total = await prisma.notificationPreference.count();
  console.log(`\n🎉 [seed-notification-preferences] Selesai!`);
  console.log(`   ✅ Diproses  : ${successCount}`);
  console.log(`   ❌ Error     : ${errorCount}`);
  console.log(`   Total preferences di DB: ${total}\n`);
}

// ── Standalone runner ──
const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);

if (isMain) {
  const prisma = createPrismaClient();
  seedNotificationPreferences(prisma)
    .catch((e) => { console.error("💥 Fatal error:", e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}