// prisma/seed-observations.ts
// ✅ FIX #3: Script migrasi data observasi dari sistem lama ke sistem baru
// Jalankan saat pertama kali deploy: npx tsx prisma/seed-observations.ts

import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const prisma = new PrismaClient();

interface ObservationData {
  id: string;
  staffName: string;   // ← sebenarnya ini NAMA RUBRIC
  rubricName: string;  // ← sebenarnya ini NIP/ID STAF
  status: string;      // ← sebenarnya ini NAMA STAF
  submittedAt: string; // ← ini status submitted/pending
  detailUrl: string;
}

// Nama staf test/dummy — skip
const TEST_NAMES = ["observer test", "observee tester"];

function parseStatus(submittedAt: string): "draft" | "submitted" | "acknowledged" {
  const s = submittedAt.toLowerCase();
  if (s.includes("acknowledged")) return "acknowledged";
  if (s.includes("submitted")) return "submitted";
  return "draft";
}

function cleanName(name: string): string {
  return name
    .replace(/,.*$/, "")
    .replace(/\b(s\.pd|s\.sos\s*i?|s\.si|s\.kom|s\.psi|s\.tp|s\.sn|s\.ikom|s\.k\.pm)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

async function main() {
  console.log("🚀 Mulai seeding observations dari sistem lama...\n");

  const jsonFilePath = path.join(__dirname, "observations.json");
  if (!fs.existsSync(jsonFilePath)) {
    console.error(`❌ File tidak ditemukan: ${jsonFilePath}`);
    console.error(`   Pastikan file observations.json ada di folder prisma/`);
    process.exit(1);
  }

  const observations: ObservationData[] = JSON.parse(fs.readFileSync(jsonFilePath, "utf-8"));
  console.log(`📋 Ditemukan ${observations.length} observation di JSON\n`);

  // Load semua rubric ke map (by name, case-insensitive)
  const allRubrics = await prisma.rubricTemplate.findMany();
  if (allRubrics.length === 0) {
    console.error("❌ Tidak ada rubric! Jalankan seed-rubrics.ts terlebih dahulu.");
    process.exit(1);
  }
  const rubricMap = new Map<string, typeof allRubrics[0]>();
  allRubrics.forEach((r) => rubricMap.set(r.name.toLowerCase().trim(), r));
  console.log(`📋 Total rubrics di database: ${allRubrics.length}`);

  // Load semua staff
  const staffUsers = await prisma.user.findMany({
    where: { roles: { some: { role: "staff" } } },
    include: { profile: true },
  });
  console.log(`📋 Total staff di database: ${staffUsers.length}\n`);

  // Build staff map: by fullName dan cleanName
  const staffByName = new Map<string, typeof staffUsers[0]>();
  const staffByCleanName = new Map<string, typeof staffUsers[0]>();

  staffUsers.forEach((u) => {
    const full = u.profile?.fullName || "";
    staffByName.set(full.toLowerCase().trim(), u);
    staffByCleanName.set(cleanName(full), u);
  });

  // Load manager & director untuk assign
  const managers = await prisma.user.findMany({
    where: { roles: { some: { role: "manager" } } },
  });
  const director = await prisma.user.findFirst({
    where: { roles: { some: { role: "director" } } },
  });

  // Cari admin untuk dipakai sebagai "updatedBy" pada audit trail historis
  const adminUser = await prisma.user.findFirst({
    where: { roles: { some: { role: "admin" } } },
  });

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const obs of observations) {
    try {
      // ── 1. Cek apakah ini entri test ──
      const statusLower = obs.status.toLowerCase();
      const isTest = TEST_NAMES.some((t) => statusLower.includes(t));

      // ── 2. Cari RUBRIC dari field staffName ──
      const rubricKey = obs.staffName.toLowerCase().trim();
      let rubric = rubricMap.get(rubricKey);

      if (!rubric) {
        for (const [key, r] of rubricMap.entries()) {
          if (key.includes(rubricKey) || rubricKey.includes(key)) {
            rubric = r;
            break;
          }
        }
      }git branch -M feature/obs-from-staging

      if (!rubric) {
        console.log(`⚠️  Skip obs ${obs.id}: rubric "${obs.staffName}" tidak ditemukan`);
        skipCount++;
        continue;
      }

      // ── 3. Cari STAFF dari field status (nama staf) ──
      let staffUser = null;

      if (!isTest) {
        const nameRaw = obs.status;
        const nameLower = nameRaw.toLowerCase().trim();
        const nameClean = cleanName(nameRaw);

        staffUser =
          staffByName.get(nameLower) ||
          staffByCleanName.get(nameClean) ||
          null;

        // Fuzzy: cari berdasarkan kata pertama
        if (!staffUser) {
          const firstName = nameClean.split(" ")[0];
          for (const [key, u] of staffByCleanName.entries()) {
            if (key.startsWith(firstName) && firstName.length > 3) {
              staffUser = u;
              break;
            }
          }
        }

        // Fallback random staff jika tidak ditemukan
        if (!staffUser && staffUsers.length > 0) {
          staffUser = staffUsers[Math.floor(Math.random() * staffUsers.length)];
          console.log(`⚠️  Obs ${obs.id}: staff "${obs.status}" tidak ditemukan, pakai random`);
        }
      } else {
        if (staffUsers.length > 0) {
          staffUser = staffUsers[Math.floor(Math.random() * staffUsers.length)];
        }
      }

      if (!staffUser) {
        console.log(`⚠️  Skip obs ${obs.id}: tidak ada staff di database`);
        skipCount++;
        continue;
      }

      // ── 4. Parse status dari field submittedAt ──
      const status = parseStatus(obs.submittedAt);
      const submittedAt = status !== "draft" ? new Date() : null;
      const acknowledgedAt = status === "acknowledged" ? new Date() : null;

      const randomManager =
        managers.length > 0
          ? managers[Math.floor(Math.random() * managers.length)]
          : null;

      const title = `${staffUser.profile?.fullName || "Staff"} - ${rubric.name}`;

      // ── 5. Upsert observation (dalam transaksi agar audit trail ikut tersimpan) ──
      await prisma.$transaction(async (tx) => {
        const upserted = await tx.observation.upsert({
          where: { id: obs.id },
          update: {
            status: status as any,
            submittedAt,
            acknowledgedAt,
            title,
            updatedAt: new Date(),
          },
          create: {
            id: obs.id,
            staffId: staffUser!.id,
            managerId: randomManager?.id ?? null,
            directorId: director?.id ?? null,
            rubricId: rubric!.id,
            status: status as any,
            type: "MANAGER",
            title,
            description: `Migrasi dari sistem lama — rubric: ${rubric!.name}`,
            submittedAt,
            acknowledgedAt,
          },
        });

        // ✅ FIX #2 (seed): Simpan audit trail historis jika status bukan draft
        // Gunakan adminUser sebagai pelaku migrasi
        if (status !== "draft" && adminUser) {
          // Cek apakah sudah ada audit trail untuk obs ini agar tidak dobel saat upsert
          const existingUpdate = await tx.observationUpdate.findFirst({
            where: { observationId: upserted.id }
          });

          if (!existingUpdate) {
            if (status === "submitted" || status === "acknowledged") {
              await tx.observationUpdate.create({
                data: {
                  observationId: upserted.id,
                  updatedById: adminUser.id,
                  statusFrom: "draft",
                  statusTo: "submitted",
                  notes: "Dimigrasi dari sistem lama (submitted)"
                }
              });
            }

            if (status === "acknowledged") {
              await tx.observationUpdate.create({
                data: {
                  observationId: upserted.id,
                  updatedById: staffUser!.id,
                  statusFrom: "submitted",
                  statusTo: "acknowledged",
                  notes: "Dimigrasi dari sistem lama (acknowledged)"
                }
              });
            }
          }
        }
      });

      console.log(`✅ Obs ${obs.id}: ${staffUser.profile?.fullName} → ${rubric.name} (${status})`);
      successCount++;
    } catch (err: any) {
      console.error(`❌ Error obs ${obs.id}:`, err.message);
      errorCount++;
    }
  }

  const total = await prisma.observation.count();
  console.log(`\n🎉 Seeding observations selesai!`);
  console.log(`   ✅ Berhasil : ${successCount}`);
  console.log(`   ⚠️  Skip    : ${skipCount}`);
  console.log(`   ❌ Error   : ${errorCount}`);
  console.log(`   Total observations di database: ${total}`);
}

main()
  .catch((e) => { console.error("💥 Fatal error:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
