import { createPrismaClient } from "./prisma-client.js";
import { seedMilestone1 } from "./seed-milestone1.js";

const prisma = createPrismaClient();

async function main() {
  console.log("Running database seed...");
  await seedMilestone1(prisma);
  console.log("Database seed completed.");
}

main()
  .catch((error) => {
    console.error("Database seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
