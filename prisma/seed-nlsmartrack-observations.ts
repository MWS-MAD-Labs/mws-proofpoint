/**
 * seed-nlsmartrack-observations.ts
 * Milestone 6: Import scraped NLSmartrack data into Proofpoint DB
 *
 * Urutan import:
 *   1. Departments
 *   2. Users + Profiles + Roles
 *   3. Observations + ObservationUpdates (audit trail)
 *
 * Jalankan setelah scrape-nlsmartrack.ts menghasilkan prisma/nlsmartrack-data.json
 */

import fs   from "fs";
import path from "path";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { createPrismaClient } from "./prisma-client.js";

interface NLSUser {
  id: string; name: string; email: string;
  role: string; department: string; job_title?: string; niy?: string;
}
interface NLSDepartment {
  id: string; name: string; parent_id?: string;
}
interface NLSObservation {
  id: string; staff_id: string; manager_id: string;
  rubric_name: string; status: string; created_at: string;
  submitted_at?: string; acknowledged_at?: string;
  answers: Array<{ indicator_name: string; score: number; note?: string; }>;
}
interface NLSData {
  scraped_at: string;
  users: NLSUser[];
  departments: NLSDepartment[];
  observations: NLSObservation[];
}

function mapObservationStatus(nlsStatus: string): string {
  const map: Record<string, string> = {
    draft: "draft", pending: "submitted", submitted: "submitted",
    reviewed: "reviewed", acknowledged: "acknowledged", completed: "acknowledged",
  };
  return map[nlsStatus.toLowerCase()] ?? "submitted";
}

function mapRole(nlsRole: string): string {
  const map: Record<string, string> = {
    teacher: "staff", staff: "staff", manager: "manager",
    principal: "manager", director: "director", admin: "admin",
  };
  return map[nlsRole.toLowerCase()] ?? "staff";
}

export async function seedNlsmartackObservations(
  client: PrismaClient,
): Promise<void> {
  const dataFile = path.resolve("prisma", "nlsmartrack-data.json");

  if (!fs.existsSync(dataFile)) {
    console.warn(
      "⚠️  prisma/nlsmartrack-data.json tidak ditemukan.\n" +
      "   Jalankan scrape-nlsmartrack.ts terlebih dahulu.\n" +
      "   Skipping seedNlsmartackObservations."
    );
    return;
  }

  const raw  = fs.readFileSync(dataFile, "utf-8");
  const data = JSON.parse(raw) as NLSData;

  console.log(`\n📥  Memulai import data NLSmartrack (scraped: ${data.scraped_at})`);
  console.log(`    Departments : ${data.departments.length}`);
  console.log(`    Users       : ${data.users.length}`);
  console.log(`    Observations: ${data.observations.length}`);

  // ── 1. Departments ─────────────────────────────────────────────────────────
  console.log("\n📦  [1/3] Import departments...");
  const deptIdMap = new Map<string, string>();

  for (const dept of data.departments) {
    const existing = await client.department.findFirst({ where: { name: dept.name } });
    if (existing) {
      deptIdMap.set(dept.id, existing.id);
      continue;
    }
    const created = await client.department.create({ data: { name: dept.name } });
    deptIdMap.set(dept.id, created.id);
    console.log(`    ✅ Department: ${dept.name}`);
  }

  // ── 2. Users + Profiles + Roles ────────────────────────────────────────────
  console.log("\n👥  [2/3] Import users...");
  const userIdMap = new Map<string, string>();
  const defaultPasswordHash = await bcrypt.hash("NLS@2025!", 10);

  for (const u of data.users) {
    const role   = mapRole(u.role);
    const deptId = u.department ? (deptIdMap.get(u.department) ?? null) : null;
    const email  = u.email.toLowerCase().trim();

    let user = await client.user.findUnique({ where: { email } });
    if (!user) {
      user = await client.user.create({
        data: {
          email,
          passwordHash:  defaultPasswordHash,
          emailVerified: true,
        },
      });
      // Set nlsmartrack_id via raw query
      await client.$executeRawUnsafe(
        `UPDATE users SET nlsmartrack_id = $1 WHERE id = $2`,
        u.id, user.id,
      );
      console.log(`    ✅ User: ${email}`);
    }
    userIdMap.set(u.id, user.id);

    // Upsert profile
    await client.profile.upsert({
      where:  { userId: user.id },
      update: { fullName: u.name, departmentId: deptId, jobTitle: u.job_title ?? null },
      create: {
        userId: user.id, email,
        fullName: u.name, niy: u.niy ?? null,
        departmentId: deptId, jobTitle: u.job_title ?? null,
      },
    });

    // Set migration_source via raw query
    await client.$executeRawUnsafe(
      `UPDATE profiles SET migration_source = 'nlsmartrack' WHERE user_id = $1`,
      user.id,
    );

    // Upsert role
    await client.userRole.upsert({
      where:  { userId_role: { userId: user.id, role: role as any } },
      update: {},
      create: { userId: user.id, role: role as any },
    });

    // Log ke migration_log
    await client.$executeRawUnsafe(
      `INSERT INTO migration_log (entity_type, source_id, target_id, notes)
       VALUES ('user', $1, $2, 'imported from nlsmartrack')
       ON CONFLICT DO NOTHING`,
      u.id, user.id,
    );
  }

  // ── 3. Observations ────────────────────────────────────────────────────────
  console.log("\n📋  [3/3] Import observations...");

  const defaultRubric = await client.rubricTemplate.findFirst({
    where: { templateType: "CLASSROOM_OBSERVATION" },
  });

  if (!defaultRubric) {
    console.warn("⚠️  Tidak ada rubric CLASSROOM_OBSERVATION. Observation dilewati.");
  } else {
    for (const obs of data.observations) {
      const staffId   = userIdMap.get(obs.staff_id);
      const managerId = userIdMap.get(obs.manager_id) ?? null;

      if (!staffId) {
        console.warn(`    ⚠️  Staff ID ${obs.staff_id} tidak ditemukan, skip.`);
        continue;
      }

      // Cek duplikat
      const existing = await client.$queryRawUnsafe<any[]>(
        `SELECT id FROM observations WHERE nlsmartrack_id = $1 LIMIT 1`,
        obs.id,
      );
      if (existing.length > 0) continue;

      const status  = mapObservationStatus(obs.status);
     const created = await client.observation.create({
  data: {
    staffId,
    managerId,

    template_id: defaultRubric.id,

    status: status as any,

    submittedAt: obs.submitted_at
      ? new Date(obs.submitted_at)
      : null,

    acknowledgedAt: obs.acknowledged_at
      ? new Date(obs.acknowledged_at)
      : null,

    createdAt: new Date(obs.created_at),
  },
});

      // Set nlsmartrack_id
      await client.$executeRawUnsafe(
        `UPDATE observations SET nlsmartrack_id = $1 WHERE id = $2`,
        obs.id, created.id,
      );

      // Audit trail
      await client.observationUpdate.create({
        data: {
          observationId: created.id,
          statusFrom:    null,
          statusTo:      status,
          notes:         "Imported from NLSmartrack",
        },
      });

      // Log
      await client.$executeRawUnsafe(
        `INSERT INTO migration_log (entity_type, source_id, target_id, notes)
         VALUES ('observation', $1, $2, 'imported from nlsmartrack')`,
        obs.id, created.id,
      );

      console.log(`    ✅ Observation: ${obs.id} → ${created.id} (${status})`);
    }
  }

  console.log("\n✅  Import NLSmartrack selesai!");
}

if (process.argv[1]?.endsWith("seed-nlsmartrack-observations.ts")) {
  const prisma = createPrismaClient();
  seedNlsmartackObservations(prisma)
    .catch((err) => {
      console.error("❌  Import gagal:", err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
