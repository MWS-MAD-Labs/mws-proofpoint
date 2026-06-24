import bcrypt from "bcrypt";
import { createPrismaClient } from "./prisma-client.js";

const prisma = createPrismaClient();

async function main() {
  console.log("Creating admin user...");

  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
if (!adminPassword) throw new Error("Set SEED_ADMIN_PASSWORD in .env");
const passwordHash = await bcrypt.hash(adminPassword, 10);

  const user = await prisma.user.upsert({
    where: { email: "ari.wibowo@millennia21.id" },
    update: { passwordHash },
    create: {
      email: "ari.wibowo@millennia21.id",
      passwordHash,
      emailVerified: true,
    },
  });

  await prisma.profile.upsert({
    where: { userId: user.id },
    update: { fullName: "Ari Wibowo" },
    create: {
      userId: user.id,
      email: "ari.wibowo@millennia21.id",
      fullName: "Ari Wibowo",
      jobTitle: "Web Developer",
    },
  });

  await prisma.userRole.upsert({
    where: { userId_role: { userId: user.id, role: "admin" } },
    update: {},
    create: { userId: user.id, role: "admin" },
  });

  console.log("✅ Admin user created!");
  console.log("   Email   : ari.wibowo@millennia21.id");
  console.log(`   Password: ${adminPassword}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
