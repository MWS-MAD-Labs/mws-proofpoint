// prisma/seed-nlsmartrack-observations.ts
// Milestone 6: Migrasikan data observasi dari NLSmartrack ke database ProofPoint
//
// Standalone : npx tsx prisma/seed-nlsmartrack-observations.ts
// Via seed.ts : import { seedNlsmartackObservations } from "./seed-nlsmartrack-observations.js"
//
// CATATAN struktur data NLSmartrack (observations.json):
//   field "staffName"   → isinya NAMA RUBRIK (bukan nama staf!)
//   field "rubricName"  → isinya NIY STAF    (bukan nama rubrik!)
//   field "status"      → isinya NAMA STAF   (bukan status!)
//   field "submittedAt" → isinya STATUS sebenarnya ("Pending", "Submitted Acknowledged", dll)
//
// Total data: 82 record

import { PrismaClient } from "@prisma/client";
import { createPrismaClient } from "./prisma-client.js";
import fs   from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

interface NLSRecord {
  id:          string;
  staffName:   string; // ← ini nama RUBRIK
  rubricName:  string; // ← ini NIY staf
  status:      string; // ← ini NAMA STAF
  submittedAt: string; // ← ini STATUS sebenarnya
  detailUrl:   string;
}

// ── Peta nama rubrik NLSmartrack → ProofPoint ──
const PETA_RUBRIK: Record<string, string> = {
  "DETAILED CLASSROOM OBSERVATION":                    "DETAILED CLASSROOM OBSERVATION",
  "CHECKLIST FOR DIRECT INSTRUCTION":                  "CHECKLIST FOR DIRECT INSTRUCTION",
  "CHECKLIST FOR DIFFERENTIATION":                     "CHECKLIST FOR DIFFERENTIATION",
  "CHECKLIST FOR LEARNING AND UNDERSTANDING":          "CHECKLIST FOR LEARNING AND UNDERSTANDING",
  "CLASSROOM DISPLAY CHECKLIST":                       "CLASSROOM DISPLAY CHECKLIST",
  "DELIVERY OF INSTRUCTION":                           "DELIVERY OF INSTRUCTION",
  "FOCUS ON LEARNERS – SMALL GROUP OR IN PAIRING":     "FOCUS ON LEARNERS – SMALL GROUP OR IN PAIRING",
  "FOCUS ON LEARNERS – STUDENT ENGAGEMENT":            "FOCUS ON LEARNERS – STUDENT ENGAGEMENT",
  "Lesson Preparation Walkthrough":                    "Lesson Preparation Walkthrough",
  "Special Education Teacher Supervision Instrument":  "Special Education Teacher Supervision Instrument",
};

type StatusDB = "draft" | "pending" | "submitted" | "acknowledged";

function petakanStatus(submittedAt: string): StatusDB {
  const teks = submittedAt.trim().replace(/\xa0/g, " ");
  if (teks.toLowerCase().includes("acknowledged")) return "acknowledged";
  if (teks.toLowerCase().includes("submitted"))    return "submitted";
  if (teks.toLowerCase() === "pending")            return "pending";
  return "draft";
}

function adalahDataTest(nama: string): boolean {
  const namaDummy = ["observer test", "observee tester", "test observation", "obstest", "obsertvertest"];
  return namaDummy.some((dummy) => nama.toLowerCase().includes(dummy));
}

// ── Export agar bisa dipanggil dari seed.ts utama ──
export async function seedNlsmartackObservations(prisma: PrismaClient): Promise<void> {
  console.log("\n🔄 [seed-nlsmartrack] Mulai migrasi data observasi dari NLSmartrack...\n");

  // ── Baca file JSON — pakai fs karena project pakai ESM (require tidak tersedia) ──
  const jsonPath = path.join(__dirname, "observations.json");
  if (!fs.existsSync(jsonPath)) {
    console.warn(`⚠️  [seed-nlsmartrack] File tidak ditemukan: ${jsonPath}`);
    console.warn(`   Lewati migrasi NLSmartrack. Taruh observations.json di folder prisma/ jika diperlukan.`);
    return;
  }

  const dataObservasi: NLSRecord[] = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  console.log(`📋 Total data yang akan diproses: ${dataObservasi.length}\n`);

  // ── 1. Pastikan admin ada ──
  const userAdmin = await prisma.user.findFirst({
    where:   { roles: { some: { role: "admin" } } },
    include: { profile: true },
  });

  if (!userAdmin) {
    throw new Error("Tidak ada user admin. Pastikan seed user sudah dijalankan terlebih dahulu.");
  }
  console.log(`✅ Admin: ${userAdmin.profile?.fullName || userAdmin.email}\n`);

  // ── 2. Siapkan cache rubrik ──
  console.log("📋 Menyiapkan rubrik-rubrik...");
  const cacheRubrik = new Map<string, string>(); // namaRubrik → id

  for (const namaRubrik of Object.values(PETA_RUBRIK)) {
    let rubrik = await prisma.rubricTemplate.findFirst({ where: { name: namaRubrik } });

    if (!rubrik) {
      rubrik = await prisma.rubricTemplate.create({
        data: {
          name:         namaRubrik,
          description:  "Formulir observasi diimpor dari NLSmartrack",
          isGlobal:     true,
          createdById:  userAdmin.id,
          templateType: "CLASSROOM_OBSERVATION",
        },
      });
      console.log(`  ✅ Rubrik baru dibuat: "${namaRubrik}"`);
    } else {
      console.log(`  ℹ️  Rubrik sudah ada : "${namaRubrik}"`);
    }

    cacheRubrik.set(namaRubrik, rubrik.id);
  }

  // ── 3. Proses setiap record ──
  console.log("\n🔄 Memulai impor data observasi...\n");

  let berhasil = 0;
  let dilewati = 0;
  let tidakAda = 0;
  let gagal    = 0;

  for (const record of dataObservasi) {
    try {
      // Petakan field (struktur JSON NLSmartrack terbalik)
      const namaRubrikAsli = record.staffName.trim();
      const niyStaf        = record.rubricName.trim();
      const namaStaf       = record.status.replace(/,$/, "").trim();
      const statusAsli     = record.submittedAt;

      // Skip data test/dummy
      if (adalahDataTest(namaStaf) || adalahDataTest(namaRubrikAsli)) {
        console.log(`⏭️  [${record.id}] Dilewati (data test): "${namaStaf}"`);
        dilewati++;
        continue;
      }

      if (!namaStaf || namaStaf.length < 2) {
        console.log(`⏭️  [${record.id}] Dilewati (nama staf kosong)`);
        dilewati++;
        continue;
      }

      // Cari staff by NIY dulu, lalu by nama
      let userStaf = null;

      if (niyStaf && niyStaf !== "-----") {
        userStaf = await prisma.user.findFirst({
          where:   { profile: { niy: niyStaf } },
          include: { profile: true },
        });
      }

      if (!userStaf) {
        const kataNama = namaStaf.split(/[,\s]+/).filter((k) => k.length > 2).slice(0, 2);
        for (const kata of kataNama) {
          userStaf = await prisma.user.findFirst({
            where:   { profile: { fullName: { contains: kata, mode: "insensitive" } } },
            include: { profile: true },
          });
          if (userStaf) break;
        }
      }

      if (!userStaf) {
        console.log(`⚠️  [${record.id}] Staf tidak ditemukan: "${namaStaf}" (NIY: ${niyStaf})`);
        tidakAda++;
        continue;
      }

      // Tentukan rubrik
      const namaRubrikDB = PETA_RUBRIK[namaRubrikAsli] || namaRubrikAsli;
      const rubrikId     = cacheRubrik.get(namaRubrikDB);

      if (!rubrikId) {
        console.log(`⚠️  [${record.id}] Rubrik tidak ada di cache: "${namaRubrikDB}"`);
        dilewati++;
        continue;
      }

      // Cek duplikat
      const sudahAda = await prisma.observation.findFirst({
        where: {
          staffId:  userStaf.id,
          rubricId: rubrikId,
          title:    { contains: "[NLSmartrack]" },
        },
      });

      if (sudahAda) {
        console.log(`⏭️  [${record.id}] Sudah ada di DB: "${namaStaf}" + "${namaRubrikDB}"`);
        dilewati++;
        continue;
      }

      // Buat observasi
      const statusDB  = petakanStatus(statusAsli);
      const tglSubmit = (statusDB === "submitted" || statusDB === "acknowledged") ? new Date() : null;
      const tglAkui   = statusDB === "acknowledged" ? new Date() : null;

      // ✅ id wajib diisi manual — schema production: Observation.id String @id (tanpa @default)
      await prisma.observation.create({
        data: {
          id:             crypto.randomUUID(),
          staffId:        userStaf.id,
          managerId:      userAdmin.id,
          rubricId:       rubrikId,
          status:         statusDB,
          type:           "MANAGER",
          title:          `[NLSmartrack] Observasi — ${userStaf.profile?.fullName || namaStaf}`,
          description:    `Diimpor dari NLSmartrack. ID asli: ${record.id}. NIY: ${niyStaf}.`,
          submittedAt:    tglSubmit,
          acknowledgedAt: tglAkui,
          acknowledgedBy: tglAkui ? userAdmin.id : null,
        },
      });

      berhasil++;
      console.log(`✅ [${record.id}] Berhasil: "${namaStaf}" (${statusDB}) — ${namaRubrikDB}`);

    } catch (err) {
      gagal++;
      console.error(`❌ [${record.id}] Error:`, err instanceof Error ? err.message : err);
    }
  }

  // ── Ringkasan ──
  console.log("\n═══════════════════════════════════════════════════");
  console.log("  Hasil Migrasi NLSmartrack");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  ✅ Berhasil diimpor          : ${berhasil}`);
  console.log(`  ⏭️  Dilewati (duplikat/test)  : ${dilewati}`);
  console.log(`  ⚠️  Staf tidak ditemukan      : ${tidakAda}`);
  console.log(`  ❌ Gagal (error)              : ${gagal}`);
  console.log(`  📋 Total diproses             : ${dataObservasi.length}`);
  console.log("═══════════════════════════════════════════════════\n");

  if (tidakAda > 0) {
    console.log(`💡 Tip: ${tidakAda} staf tidak ditemukan.`);
    console.log(`   Pastikan data user sudah di-seed dan NIY di profil sudah diisi.`);
    console.log(`   Script ini aman dijalankan ulang setelah data user dilengkapi.\n`);
  }
}

// ── Standalone runner ──
const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);

if (isMain) {
  const prisma = createPrismaClient();
  seedNlsmartackObservations(prisma)
    .catch((e) => { console.error("💥 Fatal error:", e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}