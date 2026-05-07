import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Get Elementary department
  const elementary = await prisma.department.findFirst({
    where: { name: { contains: "Elementary", mode: "insensitive" } }
  });
  
  if (!elementary) {
    console.log("❌ Department Elementary tidak ditemukan!");
    return;
  }
  console.log(`✅ Department Elementary: ${elementary.id}`);

  // Get MWS Principal rubric (has KPIs)
  const rubric = await prisma.rubricTemplate.findFirst({
    where: { name: { contains: "Principal", mode: "insensitive" } }
  });
  
  if (!rubric) {
    console.log("❌ Rubric Principal tidak ditemukan!");
    return;
  }
  console.log(`✅ Rubric: ${rubric.name} (${rubric.id})`);

  // Check if Elementary-staff already exists
  const existing = await prisma.departmentRole.findFirst({
    where: { departmentId: elementary.id, role: "staff" }
  });

  if (existing) {
    console.log(`⏭️  Elementary-staff sudah ada (id: ${existing.id})`);
    // Update rubric jika berbeda
    if (existing.defaultTemplateId !== rubric.id) {
      await prisma.departmentRole.update({
        where: { id: existing.id },
        data: { defaultTemplateId: rubric.id }
      });
      console.log(`✅ Rubric di-update ke: ${rubric.name}`);
    }
    return;
  }

  // Create Elementary-staff
  const newRole = await prisma.departmentRole.create({
    data: {
      departmentId: elementary.id,
      role: "staff",
      defaultTemplateId: rubric.id,
      name: "Elementary Staff"
    }
  });
  console.log(`✅ Dibuat: Elementary - staff (id: ${newRole.id})`);
  console.log(`   Rubric: ${rubric.name}`);
}

main()
  .catch(e => { console.error("❌ Error:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());