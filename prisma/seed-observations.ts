// prisma/seed-observations.ts
// ✅ FIX #3: Migrasi data observasi dari sistem lama (NLSmartrack) ke sistem baru
// Schema production: Observation.id dan ObservationUpdate.id = String @id (tanpa @default)
//                   → wajib isi manual dengan crypto.randomUUID()
//
// Standalone : npx tsx prisma/seed-observations.ts
// Via seed.ts : import { seedObservations } from "./seed-observations.js"

import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

interface ObservationData {
  id: string;
  staffName:   string; // ← sebenarnya NAMA RUBRIC
  rubricName:  string; // ← sebenarnya NIY/ID STAF
  status:      string; // ← sebenarnya NAMA STAF
  submittedAt: string; // ← sebenarnya STATUS (submitted/pending/acknowledged)
  detailUrl:   string;
}

const TEST_NAMES = ["observer test", "observee tester"];

function parseStatus(submittedAt: string): "draft" | "submitted" | "acknowledged" {
  const s = submittedAt.toLowerCase();
  if (s.includes("acknowledged")) return "acknowledged";
  if (s.includes("submitted"))    return "submitted";
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

export async function seedObservations(prisma: PrismaClient): Promise<void> {
  console.log("\n🔍 [seed-observations] Mulai migrasi observations dari sistem lama...\n");

  const jsonFilePath = path.join(__dirname, "observations.json");
  if (!fs.existsSync(jsonFilePath)) {
    console.warn(`⚠️  [seed-observations] File tidak ditemukan: ${jsonFilePath}`);
    console.warn(`   Lewati migrasi. Taruh observations.json di folder prisma/ jika diperlukan.`);
    return; // tidak exit — biar seed utama tetap lanjut
  }

  const observations: ObservationData[] = JSON.parse(
    fs.readFileSync(jsonFilePath, "utf-8")
  );
  console.log(`📋 Ditemukan ${observations.length} observation di JSON`);

  // ── Load rubrics ──
  const allRubrics = await prisma.rubricTemplate.findMany();
  if (allRubrics.length === 0) {
    throw new Error("Rubric belum ada. Jalankan seedRubrics terlebih dahulu.");
  }
  const rubricMap = new Map<string, typeof allRubrics[0]>();
  allRubrics.forEach((r) => rubricMap.set(r.name.toLowerCase().trim(), r));
  console.log(`📋 Total rubrics : ${allRubrics.length}`);

  // ── Load staff ──
  const staffUsers = await prisma.user.findMany({
    where:   { roles: { some: { role: "staff" } } },
    include: { profile: true },
  });
  console.log(`📋 Total staff   : ${staffUsers.length}`);

  const staffByName      = new Map<string, typeof staffUsers[0]>();
  const staffByCleanName = new Map<string, typeof staffUsers[0]>();
  staffUsers.forEach((u) => {
    const full = u.profile?.fullName || "";
    staffByName.set(full.toLowerCase().trim(), u);
    staffByCleanName.set(cleanName(full), u);
  });

  // ── Load roles ──
  const managers = await prisma.user.findMany({ where: { roles: { some: { role: "manager" } } } });
  const director = await prisma.user.findFirst({ where: { roles: { some: { role: "director" } } } });
  const adminUser= await prisma.user.findFirst({ where: { roles: { some: { role: "admin" } } } });

  let successCount = 0;
  let skipCount    = 0;
  let errorCount   = 0;

  for (const obs of observations) {
    try {
      // ── 1. Cek data test ──
      const statusLower = obs.status.toLowerCase();
      const isTest = TEST_NAMES.some((t) => statusLower.includes(t));

      // ── 2. Cari rubric ──
      const rubricKey = obs.staffName.toLowerCase().trim();
      let rubric = rubricMap.get(rubricKey);
      if (!rubric) {
        for (const [key, r] of rubricMap.entries()) {
          if (key.includes(rubricKey) || rubricKey.includes(key)) { rubric = r; break; }
        }
      }
      if (!rubric) {
        console.log(`⚠️  Skip obs ${obs.id}: rubric "${obs.staffName}" tidak ditemukan`);
        skipCount++;
        continue;
      }

      // ── 3. Cari staff ──
      let staffUser = null;
      if (!isTest) {
        const nameRaw   = obs.status;
        const nameLower = nameRaw.toLowerCase().trim();
        const nameClean = cleanName(nameRaw);
        staffUser = staffByName.get(nameLower) || staffByCleanName.get(nameClean) || null;

         if (!staffUser) {
          const firstName = nameClean.split(" ")[0];
          if (firstName && firstName.length > 3) {
            for (const [key, u] of staffByCleanName.entries()) {
              if (key.startsWith(firstName)) { staffUser = u; break; }
            }
          }
        }  // ← ini yang kurang
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

      // ── 4. Parse status ──
      const status        = parseStatus(obs.submittedAt);
      const submittedAt   = status !== "draft" ? new Date() : null;
      const acknowledgedAt= status === "acknowledged" ? new Date() : null;
      const randomManager = managers.length > 0
        ? managers[Math.floor(Math.random() * managers.length)]
        : null;
      const title = `${staffUser.profile?.fullName || "Staff"} - ${rubric.name}`;

      // ── 5. Upsert observation + audit trail ──
      await prisma.$transaction(async (tx) => {
        const upserted = await tx.observation.upsert({
          where:  { id: obs.id },
          update: { status: status as any, submittedAt, acknowledgedAt, title, updatedAt: new Date() },
          create: {
            id:            obs.id, // id dari sistem lama dipertahankan
            staffId:       staffUser!.id,
            managerId:     randomManager?.id ?? null,
            directorId:    director?.id ?? null,
            rubricId:      rubric!.id,
            status:        status as any,
            type:          "MANAGER",
            title,
            description:   `Migrasi dari sistem lama — rubric: ${rubric!.name}`,
            submittedAt,
            acknowledgedAt,
          },
        });

        // ✅ Audit trail — hanya jika belum ada
        if (status !== "draft" && adminUser) {
          const existingUpdate = await tx.observationUpdate.findFirst({
            where: { observationId: upserted.id },
          });

          if (!existingUpdate) {
            if (status === "submitted" || status === "acknowledged") {
              await tx.observationUpdate.create({
                data: {
                  id:            crypto.randomUUID(), // ✅ wajib isi — schema: id String @id (tanpa @default)
                  observationId: upserted.id,
                  updatedById:   adminUser.id,
                  statusFrom:    "draft",
                  statusTo:      "submitted",
                  notes:         "Dimigrasi dari sistem lama (submitted)",
                },
              });
            }
            if (status === "acknowledged") {
              await tx.observationUpdate.create({
                data: {
                  id:            crypto.randomUUID(), // ✅ wajib isi — schema: id String @id (tanpa @default)
                  observationId: upserted.id,
                  updatedById:   staffUser!.id,
                  statusFrom:    "submitted",
                  statusTo:      "acknowledged",
                  notes:         "Dimigrasi dari sistem lama (acknowledged)",
                },
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
  console.log(`\n🎉 [seed-observations] Selesai!`);
  console.log(`   ✅ Berhasil : ${successCount}`);
  console.log(`   ⚠️  Skip    : ${skipCount}`);
  console.log(`   ❌ Error   : ${errorCount}`);
  console.log(`   Total observations di DB: ${total}\n`);
}

// ── Standalone runner ──
const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);

if (isMain) {
  const prisma = new PrismaClient();
  seedObservations(prisma)
    .catch((e) => { console.error("💥 Fatal error:", e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}