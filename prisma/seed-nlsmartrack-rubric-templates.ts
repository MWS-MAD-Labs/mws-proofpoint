/**
 * seed-nlsmartrack-rubric-templates.ts
 * Milestone 6: Generate RubricTemplate placeholder untuk setiap rubric_name
 * unik yang ditemukan di prisma/nlsmartrack-data.json.
 *
 * PENTING: jalankan SEBELUM seed-nlsmartrack-observations.ts.
 * Script observation melakukan lookup template berdasarkan nama
 * (case-insensitive) dan fallback ke templateType CLASSROOM_OBSERVATION —
 * tanpa template ini, semua observation akan ter-skip (errorCount).
 *
 * Catatan penting soal data:
 * Source NLSmartrack tidak menyertakan detail indicator/section
 * (semua observation.answers kosong di hasil scrape). Karena itu setiap
 * template di sini hanya dibuat dengan SATU RubricSection placeholder
 * ("General") tanpa RubricIndicator sama sekali. Section & indicator asli
 * (sesuai rubric resmi sekolah) harus diisi manual nanti lewat UI/admin
 * setelah proses migrasi ini selesai.
 *
 * Jalankan:
 *   npx tsx prisma/seed-nlsmartrack-rubric-templates.ts
 */

import fs   from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { createPrismaClient } from "./prisma-client.js";

interface NLSObservation {
  rubric_name: string;
  [key: string]: any;
}
interface NLSData {
  observations: NLSObservation[];
  [key: string]: any;
}

/**
 * Mengembalikan Map<rubric_name lowercase, templateId> supaya bisa dipakai
 * langsung oleh seed-nlsmartrack-observations.ts kalau dipanggil berurutan
 * dari satu orchestrator (prisma/seed.ts), tanpa perlu query ulang ke DB.
 */
export async function seedNlsmartrackRubricTemplates(
  client: PrismaClient,
): Promise<Map<string, string>> {
  const dataFile = path.resolve("prisma", "nlsmartrack-data.json");
  const templateIdMap = new Map<string, string>();

  if (!fs.existsSync(dataFile)) {
    console.warn(
      "⚠️  prisma/nlsmartrack-data.json tidak ditemukan.\n" +
      "   Skipping seedNlsmartrackRubricTemplates."
    );
    return templateIdMap;
  }

  const raw  = fs.readFileSync(dataFile, "utf-8");
  const data = JSON.parse(raw) as NLSData;

  const uniqueNames = [...new Set(
    data.observations.map((o) => o.rubric_name?.trim()).filter(Boolean)
  )] as string[];

  console.log(`\n📐  Memulai seed rubric templates dari NLSmartrack`);
  console.log(`    Rubric unik ditemukan: ${uniqueNames.length}`);

  let createdCount = 0;
  let skippedCount = 0;

  for (const name of uniqueNames) {
    const key = name.toLowerCase().trim();

    // Cek duplikat (case-insensitive) — aman dijalankan berkali-kali
    const existing = await client.rubricTemplate.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
    });

    if (existing) {
      templateIdMap.set(key, existing.id);
      console.log(`    ⏭️  Template (sudah ada): ${name}`);
      skippedCount++;
      continue;
    }

    const created = await client.rubricTemplate.create({
      data: {
        name,
        description:
          "Diimpor dari NLSmartrack. Data indicator/section asli tidak " +
          "tersedia di hasil scrape — section & indicator perlu dilengkapi " +
          "manual lewat halaman admin rubric.",
        templateType: "CLASSROOM_OBSERVATION" as any,
        isGlobal:     true,
        isActive:     true,
        sections: {
          create: [
            { name: "General", sortOrder: 0 },
          ],
        },
      },
    });

    templateIdMap.set(key, created.id);
    console.log(`    ✅ Template dibuat: ${name} (${created.id})`);
    createdCount++;
  }

  console.log(`\n✅  Seed rubric templates selesai!`);
  console.log(`    ✅ Dibuat   : ${createdCount}`);
  console.log(`    ⏭️  Dilewati : ${skippedCount} (sudah ada sebelumnya)`);

  return templateIdMap;
}

if (process.argv[1]?.endsWith("seed-nlsmartrack-rubric-templates.ts")) {
  const prisma = createPrismaClient();
  seedNlsmartrackRubricTemplates(prisma)
    .catch((err) => {
      console.error("❌  Seed rubric templates gagal:", err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}