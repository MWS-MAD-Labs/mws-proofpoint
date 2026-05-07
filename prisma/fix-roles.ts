// prisma/fix-roles.ts
// Fix roles dari CSV — standalone: npx tsx prisma/fix-roles.ts

import "dotenv/config";
import { PrismaPg }     from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool }         from "pg";
import fs   from "fs";
import path from "path";
import { parse } from "csv-parse/sync";

// ✅ FIX: pakai adapter pg seperti seed lainnya (Prisma v7 requirement)
function createPrismaClient(): PrismaClient {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL tidak ditemukan di environment.");
  }
  const pool    = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter } as never);
}

// ✅ FIX: definisikan tipe untuk CSV record agar tidak 'unknown'
interface CsvRecord {
  email: string;
  role:  string;
}

function parseRole(roleStr: string): string {
  const clean = roleStr?.trim().toLowerCase();
  if (clean === "manager")  return "manager";
  if (clean === "director") return "director";
  if (clean === "admin")    return "admin";
  return "staff";
}

async function main() {
  const prisma = createPrismaClient();
  console.log("🔧 Fix-roles script dimulai...\n");

  const csvFilePath  = path.resolve("./prisma/users.csv");
  const fileContent  = fs.readFileSync(csvFilePath, "utf-8");

  // ✅ FIX: cast records ke CsvRecord[] agar tidak 'unknown'
  const records = parse(fileContent, {
    columns:           true,
    skip_empty_lines:  true,
  }) as CsvRecord[];

  let fixed    = 0;
  let notFound = 0;

  for (const record of records) {
    // ✅ FIX: record sudah typed — tidak ada lagi error TS18046
    const email     = record.email?.trim();
    const roleValue = parseRole(record.role);

    if (!email) continue;

    const user = await prisma.user.findUnique({
      where:   { email },
      include: { roles: true },
    });

    if (!user) {
      console.log(`⚠️  User tidak ditemukan di DB: ${email}`);
      notFound++;
      continue;
    }

    const existingRoles  = user.roles.map((r) => r.role as string);
    const hasCorrectRole = existingRoles.includes(roleValue);

    if (!hasCorrectRole) {
      await prisma.userRole.upsert({
        where:  { userId_role: { userId: user.id, role: roleValue as never } },
        update: {},
        create: { userId: user.id, role: roleValue as never },
      });
      console.log(`✅ Fix role ${email}: [] → [${roleValue}]`);
    } else {
      console.log(`✓  ${email}: sudah punya role [${existingRoles.join(", ")}]`);
    }

    const hasStaff = existingRoles.includes("staff") || roleValue === "staff";
    if (!hasStaff) {
      await prisma.userRole.upsert({
        where:  { userId_role: { userId: user.id, role: "staff" as never } },
        update: {},
        create: { userId: user.id, role: "staff" as never },
      });
    }

    fixed++;
  }

  console.log(`\n🎉 Fix selesai!`);
  console.log(`   ✅ Diproses         : ${fixed}`);
  console.log(`   ⚠️  Tidak ada di DB  : ${notFound}`);

  console.log("\n📊 Role summary setelah fix:");
  const roleCounts = await prisma.userRole.groupBy({
    by:     ["role"],
    _count: { role: true },
  });
  for (const r of roleCounts) {
    console.log(`   ${r.role}: ${r._count.role} user`);
  }

  console.log("\n👔 User dengan role manager:");
  const managers = await prisma.userRole.findMany({
    where:   { role: "manager" as never },
    include: { user: { select: { email: true } } },
  });
  for (const m of managers) {
    console.log(`   - ${m.user.email}`);
  }

  await prisma.$disconnect();
}

main()
  .catch((e) => { console.error("💥 Error:", e); process.exit(1); });