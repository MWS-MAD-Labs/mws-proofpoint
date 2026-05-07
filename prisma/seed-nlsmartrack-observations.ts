// prisma/seed-nlsmartrack-observations.ts
// Migrate observation data from NLSmartrack to ProofPoint database
//
// Standalone: npx tsx prisma/seed-nlsmartrack-observations.ts
// Via seed.ts: import { seedNlsmartackObservations } from "./seed-nlsmartrack-observations.js"
//
// NOTE: NLSmartrack data structure in observations.json has swapped fields:
//   field "staffName"   → actually contains the RUBRIC NAME (not staff name!)
//   field "rubricName"  → actually contains the STAFF NIY   (not rubric name!)
//   field "status"      → actually contains the STAFF NAME  (not status!)
//   field "submittedAt" → actually contains the STATUS      ("Pending", "Submitted Acknowledged", etc.)
//
// Total records: 82

import { PrismaClient } from "@prisma/client";
import { createPrismaClient } from "./prisma-client.js";
import fs   from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

interface NLSRecord {
  id:          string;
  staffName:   string; // ← actually RUBRIC NAME
  rubricName:  string; // ← actually STAFF NIY
  status:      string; // ← actually STAFF NAME
  submittedAt: string; // ← actually the real STATUS
  detailUrl:   string;
}

// ── Rubric name mapping: NLSmartrack → ProofPoint ──
const RUBRIC_MAP: Record<string, string> = {
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

function mapStatus(submittedAt: string): StatusDB {
  const text = submittedAt.trim().replace(/\xa0/g, " ");
  if (text.toLowerCase().includes("acknowledged")) return "acknowledged";
  if (text.toLowerCase().includes("submitted"))    return "submitted";
  if (text.toLowerCase() === "pending")            return "pending";
  return "draft";
}

function isTestData(name: string): boolean {
  const testNames = ["observer test", "observee tester", "test observation", "obstest", "obsertvertest"];
  return testNames.some((t) => name.toLowerCase().includes(t));
}

// ── Export so it can be called from the main seed.ts ──
export async function seedNlsmartackObservations(prisma: PrismaClient): Promise<void> {
  console.log("\n🔄 [seed-nlsmartrack] Starting NLSmartrack observation migration...\n");

  const jsonPath = path.join(__dirname, "observations.json");
  if (!fs.existsSync(jsonPath)) {
    console.warn(`⚠️  [seed-nlsmartrack] File not found: ${jsonPath}`);
    console.warn(`   Skipping NLSmartrack migration. Place observations.json in the prisma/ folder if needed.`);
    return;
  }

  const records: NLSRecord[] = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  console.log(`📋 Total records to process: ${records.length}\n`);

  // ── 1. Ensure admin user exists ──
  const adminUser = await prisma.user.findFirst({
    where:   { roles: { some: { role: "admin" } } },
    include: { profile: true },
  });

  if (!adminUser) {
    throw new Error("No admin user found. Please run the user seed first.");
  }
  console.log(`✅ Admin: ${adminUser.profile?.fullName ?? adminUser.email}\n`);

  // ── 2. Prepare rubric cache ──
  console.log("📋 Preparing rubrics...");
  const rubricCache = new Map<string, string>();

  for (const rubricName of Object.values(RUBRIC_MAP)) {
    let rubric = await prisma.rubricTemplate.findFirst({ where: { name: rubricName } });

    if (!rubric) {
      rubric = await prisma.rubricTemplate.create({
        data: {
          name:         rubricName,
          description:  "Observation form imported from NLSmartrack",
          isGlobal:     true,
          createdById:  adminUser.id,
          templateType: "CLASSROOM_OBSERVATION",
        },
      });
      console.log(`  ✅ New rubric created: "${rubricName}"`);
    } else {
      console.log(`  ℹ️  Rubric already exists: "${rubricName}"`);
    }

    rubricCache.set(rubricName, rubric.id);
  }

  // ── 3. Process each record ──
  console.log("\n🔄 Starting observation import...\n");

  let imported = 0;
  let skipped  = 0;
  let notFound = 0;
  let failed   = 0;

  for (const record of records) {
    try {
      const rubricNameRaw = record.staffName.trim();
      const staffNiy      = record.rubricName.trim();
      const staffName     = record.status.replace(/,$/, "").trim();
      const statusRaw     = record.submittedAt;

      if (isTestData(staffName) || isTestData(rubricNameRaw)) {
        console.log(`⏭️  [${record.id}] Skipped (test data): "${staffName}"`);
        skipped++;
        continue;
      }

      if (!staffName || staffName.length < 2) {
        console.log(`⏭️  [${record.id}] Skipped (empty staff name)`);
        skipped++;
        continue;
      }

      let staffUser = null;

      if (staffNiy && staffNiy !== "-----") {
        staffUser = await prisma.user.findFirst({
          where:   { profile: { niy: staffNiy } },
          include: { profile: true },
        });
      }

      if (!staffUser) {
        const nameTokens = staffName.split(/[,\s]+/).filter((k) => k.length > 2).slice(0, 2);
        for (const token of nameTokens) {
          staffUser = await prisma.user.findFirst({
            where:   { profile: { fullName: { contains: token, mode: "insensitive" } } },
            include: { profile: true },
          });
          if (staffUser) break;
        }
      }

      if (!staffUser) {
        console.log(`⚠️  [${record.id}] Staff not found: "${staffName}" (NIY: ${staffNiy})`);
        notFound++;
        continue;
      }

      const rubricNameDB = RUBRIC_MAP[rubricNameRaw] ?? rubricNameRaw;
      const rubricId     = rubricCache.get(rubricNameDB);

      if (!rubricId) {
        console.log(`⚠️  [${record.id}] Rubric not in cache: "${rubricNameDB}"`);
        skipped++;
        continue;
      }

      const existing = await prisma.observation.findFirst({
        where: {
          staffId:  staffUser.id,
          rubricId: rubricId,
          title:    { contains: "[NLSmartrack]" },
        },
      });

      if (existing) {
        console.log(`⏭️  [${record.id}] Already in DB: "${staffName}" + "${rubricNameDB}"`);
        skipped++;
        continue;
      }

      const statusDB         = mapStatus(statusRaw);
      const submittedDate    = (statusDB === "submitted" || statusDB === "acknowledged") ? new Date() : null;
      const acknowledgedDate = statusDB === "acknowledged" ? new Date() : null;

      await prisma.observation.create({
        data: {
          id:             crypto.randomUUID(),
          staffId:        staffUser.id,
          managerId:      adminUser.id,
          rubricId:       rubricId,
          status:         statusDB,
          type:           "MANAGER",
          title:          `[NLSmartrack] Observation — ${staffUser.profile?.fullName ?? staffName}`,
          description:    `Imported from NLSmartrack. Original ID: ${record.id}. NIY: ${staffNiy}.`,
          submittedAt:    submittedDate,
          acknowledgedAt: acknowledgedDate,
          acknowledgedBy: acknowledgedDate ? adminUser.id : null,
        },
      });

      imported++;
      console.log(`✅ [${record.id}] Imported: "${staffName}" (${statusDB}) — ${rubricNameDB}`);

    } catch (err: unknown) {
      failed++;
      console.error(`❌ [${record.id}] Error:`, err instanceof Error ? err.message : err);
    }
  }

  // ── Summary ──
  console.log("\n═══════════════════════════════════════════════════");
  console.log("  NLSmartrack Migration Result");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  ✅ Successfully imported  : ${imported}`);
  console.log(`  ⏭️  Skipped (dup/test)    : ${skipped}`);
  console.log(`  ⚠️  Staff not found       : ${notFound}`);
  console.log(`  ❌ Failed (errors)        : ${failed}`);
  console.log(`  📋 Total processed        : ${records.length}`);
  console.log("═══════════════════════════════════════════════════\n");

  if (notFound > 0) {
    console.log(`💡 Tip: ${notFound} staff member(s) not found.`);
    console.log(`   Ensure user data is seeded and NIY is filled in their profile.`);
    console.log(`   This script is safe to re-run after user data is completed.\n`);
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