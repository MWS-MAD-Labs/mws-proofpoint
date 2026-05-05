// =============================================================================
// prisma/seed-nlsmartrack-observations.ts
// Milestone 6: Migrasikan data observasi dari NLSmartrack ke database ProofPoint
//
// CARA MENJALANKAN:
//   npx ts-node --project tsconfig.json prisma/seed-nlsmartrack-observations.ts
//
// CATATAN PENTING tentang struktur data NLSmartrack (observations.json):
//   - field "staffName"  → isinya NAMA RUBRIK (bukan nama staf!)
//   - field "rubricName" → isinya NIY STAF (bukan nama rubrik!)
//   - field "status"     → isinya NAMA STAF (bukan status!)
//   - field "submittedAt"→ isinya STATUS sebenarnya ("Pending", "Submitted Acknowledged", dll)
//
// Total data: 82 record
// =============================================================================

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ─── Import data JSON (pakai require karena resolveJsonModule) ─────────────────
// eslint-disable-next-line @typescript-eslint/no-var-requires
const dataObservasi = require("./observations.json") as Array<{
  id:          string;
  staffName:   string; // Perhatian: ini nama RUBRIK
  rubricName:  string; // Perhatian: ini NIY staf
  status:      string; // Perhatian: ini NAMA STAF
  submittedAt: string; // Perhatian: ini STATUS sebenarnya
  detailUrl:   string;
}>;

// ─── Peta nama rubrik dari NLSmartrack ke nama yang dipakai di ProofPoint ─────
const PETA_RUBRIK: Record<string, string> = {
  "DETAILED CLASSROOM OBSERVATION":           "DETAILED CLASSROOM OBSERVATION",
  "CHECKLIST FOR DIRECT INSTRUCTION":         "CHECKLIST FOR DIRECT INSTRUCTION",
  "CHECKLIST FOR DIFFERENTIATION":            "CHECKLIST FOR DIFFERENTIATION",
  "CHECKLIST FOR LEARNING AND UNDERSTANDING": "CHECKLIST FOR LEARNING AND UNDERSTANDING",
  "CLASSROOM DISPLAY CHECKLIST":              "CLASSROOM DISPLAY CHECKLIST",
  "DELIVERY OF INSTRUCTION":                  "DELIVERY OF INSTRUCTION",
  "FOCUS ON LEARNERS – SMALL GROUP OR IN PAIRING": "FOCUS ON LEARNERS – SMALL GROUP OR IN PAIRING",
  "FOCUS ON LEARNERS – STUDENT ENGAGEMENT":   "FOCUS ON LEARNERS – STUDENT ENGAGEMENT",
  "Lesson Preparation Walkthrough":           "Lesson Preparation Walkthrough",
  "Special Education Teacher Supervision Instrument": "Special Education Teacher Supervision Instrument",
};

// ─── Helper: tentukan status database dari teks NLSmartrack ───────────────────
type StatusDB = "draft" | "pending" | "submitted" | "acknowledged";

function petakanStatus(submittedAt: string): StatusDB {
  const teks = submittedAt.trim().replace(/\xa0/g, " "); // hapus non-breaking space

  if (teks.toLowerCase().includes("acknowledged")) {
    return "acknowledged";
  }
  if (teks.toLowerCase().includes("submitted")) {
    return "submitted";
  }
  if (teks.toLowerCase() === "pending") {
    return "pending";
  }
  return "draft";
}

// ─── Helper: apakah data ini adalah data test/dummy? ─────────────────────────
function adalahDataTest(namaStaf: string): boolean {
  const namaDummy = [
    "observer test",
    "observee tester",
    "test observation",
    "obstest",
    "obsertvertest",
  ];
  return namaDummy.some((dummy) =>
    namaStaf.toLowerCase().includes(dummy)
  );
}

// ─── Fungsi utama ─────────────────────────────────────────────────────────────
async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  Migrasi Data Observasi dari NLSmartrack");
  console.log("  Total data yang akan diproses:", dataObservasi.length);
  console.log("═══════════════════════════════════════════════════\n");

  // 1. Cari user Admin (akan dijadikan creator dan default manager)
  const userAdmin = await prisma.user.findFirst({
    where:   { roles: { some: { role: "admin" } } },
    include: { profile: true },
  });

  if (!userAdmin) {
    console.error("❌ Tidak ada user admin ditemukan!");
    console.error("   Pastikan sudah menjalankan seed user terlebih dahulu.");
    process.exit(1);
  }

  console.log(`✅ Admin ditemukan: ${userAdmin.profile?.fullName || userAdmin.email}\n`);

  // 2. Ambil atau buat semua rubrik yang dibutuhkan
  console.log("📋 Menyiapkan rubrik-rubrik...");
  const cacheRubrik: Map<string, string> = new Map(); // namaRubrik → id

  for (const namaRubrik of Object.values(PETA_RUBRIK)) {
    let rubrik = await prisma.rubricTemplate.findFirst({
      where: { name: namaRubrik },
    });

    if (!rubrik) {
      // Buat rubrik jika belum ada
      rubrik = await prisma.rubricTemplate.create({
        data: {
          name:        namaRubrik,
          description: `Formulir observasi diimpor dari NLSmartrack`,
          isGlobal:    true,
          createdById: userAdmin.id,
        },
      });
      console.log(`  ✅ Rubrik baru dibuat: "${namaRubrik}"`);
    } else {
      console.log(`  ℹ️  Rubrik sudah ada: "${namaRubrik}"`);
    }

    cacheRubrik.set(namaRubrik, rubrik.id);
  }

  console.log("\n🔄 Memulai impor data observasi...\n");

  // 3. Proses setiap record observasi
  let berhasil  = 0;
  let dilewati  = 0;
  let tidakAda  = 0; // staf tidak ditemukan
  let gagal     = 0;

  for (const record of dataObservasi) {
    try {
      // ── Petakan field (ingat: struktur JSON terbalik!) ──────────────────
      const namaRubrikAsli = record.staffName.trim();    // ini nama rubrik
      const niyStaf        = record.rubricName.trim();   // ini NIY staf
      const namaStaf       = record.status              // ini nama staf
        .replace(/,$/, "")                              // hapus trailing koma
        .trim();
      const statusAsli     = record.submittedAt;        // ini status sebenarnya

      // ── Skip data test/dummy ────────────────────────────────────────────
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

      // ── Cari user staf berdasarkan nama atau NIY ────────────────────────
      let userStaf = null;

      // Coba cari berdasarkan NIY dulu
      if (niyStaf && niyStaf !== "-----") {
        userStaf = await prisma.user.findFirst({
          where: { profile: { niy: niyStaf } },
          include: { profile: true },
        });
      }

      // Jika tidak ketemu by NIY, coba by nama
      if (!userStaf) {
        const kataNama = namaStaf
          .split(/[,\s]+/)
          .filter((k) => k.length > 2)
          .slice(0, 2); // ambil 2 kata pertama

        for (const kata of kataNama) {
          userStaf = await prisma.user.findFirst({
            where: {
              profile: {
                fullName: { contains: kata, mode: "insensitive" },
              },
            },
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

      // ── Tentukan rubrik ─────────────────────────────────────────────────
      const namaRubrikDB = PETA_RUBRIK[namaRubrikAsli] || namaRubrikAsli;
      const rubrikId     = cacheRubrik.get(namaRubrikDB);

      if (!rubrikId) {
        console.log(`⚠️  [${record.id}] Rubrik tidak ada di cache: "${namaRubrikDB}"`);
        dilewati++;
        continue;
      }

      // ── Tentukan status ─────────────────────────────────────────────────
      const statusDB = petakanStatus(statusAsli);

      // ── Cek duplikat ────────────────────────────────────────────────────
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

      // ── Buat observasi ──────────────────────────────────────────────────
      const tglSubmit = (statusDB === "submitted" || statusDB === "acknowledged")
        ? new Date()
        : null;

      const tglAkui = statusDB === "acknowledged"
        ? new Date()
        : null;

      await prisma.observation.create({
        data: {
          staffId:        userStaf.id,
          managerId:      userAdmin.id,    // default ke admin
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

  // ─── Ringkasan ──────────────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════");
  console.log("  Hasil Migrasi NLSmartrack");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  ✅ Berhasil diimpor : ${berhasil}`);
  console.log(`  ⏭️  Dilewati (duplikat/test): ${dilewati}`);
  console.log(`  ⚠️  Staf tidak ditemukan: ${tidakAda}`);
  console.log(`  ❌ Gagal (error)    : ${gagal}`);
  console.log(`  📋 Total diproses   : ${dataObservasi.length}`);
  console.log("═══════════════════════════════════════════════════");

  if (tidakAda > 0) {
    console.log(`\n💡 Tip: ${tidakAda} staf tidak ditemukan.`);
    console.log("   Pastikan data user sudah di-seed, atau NIY di profil sudah diisi.");
    console.log("   Anda bisa jalankan ulang script ini setelah data user dilengkapi.\n");
  }
}

main()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
