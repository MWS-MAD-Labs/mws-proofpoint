// prisma/seed-milestone1.ts
// Data migration script for Milestone 1
// Converts existing DepartmentRole configs into "Annual Appraisal" workflow assignments
//
// Usage: npx tsx prisma/seed-milestone1.ts

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🚀 Milestone 1: Running workflow data migration...\n");

  // ── 1. Create "Annual Appraisal" WorkflowDefinition if it does not exist ──
  let annualAppraisalWorkflow = await prisma.workflowDefinition.findFirst({
    where: { name: "Annual Appraisal" },
  });

  if (!annualAppraisalWorkflow) {
    annualAppraisalWorkflow = await prisma.workflowDefinition.create({
      data: {
        name: "Annual Appraisal",
        type: "KPI_APPRAISAL",
        description:
          "Standard annual appraisal workflow: staff self-assessment → manager review → director approval → acknowledgement",
        steps: {
          create: [
            {
              stepOrder: 1,
              actorRole: "staff",
              actionType: "FILL_FORM",
              description: "Staff fills in self-assessment",
            },
            {
              stepOrder: 2,
              actorRole: "manager",
              actionType: "REVIEW",
              description: "Manager performs review and scoring",
            },
            {
              stepOrder: 3,
              actorRole: "director",
              actionType: "APPROVE",
              description: "Director approves the appraisal result",
            },
            {
              stepOrder: 4,
              actorRole: "staff",
              actionType: "ACKNOWLEDGE",
              description: "Staff acknowledges the appraisal result",
            },
          ],
        },
      },
    });
    console.log(`✅ WorkflowDefinition created: "Annual Appraisal" (id: ${annualAppraisalWorkflow.id})`);
  } else {
    console.log(`⏭️  WorkflowDefinition already exists: "Annual Appraisal" (id: ${annualAppraisalWorkflow.id})`);
  }

  // ── 2. Fetch all existing DepartmentRoles ─────────────────────────────────
  const departmentRoles = await prisma.departmentRole.findMany({
    include: {
      department: { select: { name: true } },
    },
  });

  console.log(`\n📋 Found ${departmentRoles.length} DepartmentRole(s) to migrate...\n`);

  let created = 0;
  let skipped = 0;

  for (const deptRole of departmentRoles) {
    const existing = await prisma.roleWorkflowAssignment.findFirst({
      where: {
        departmentRoleId: deptRole.id,
        workflowId: annualAppraisalWorkflow.id,
      },
    });

    if (existing) {
      console.log(`  ⏭️  Skip: ${deptRole.department?.name ?? "(no dept)"} — ${deptRole.role}`);
      skipped++;
      continue;
    }

    await prisma.roleWorkflowAssignment.create({
      data: {
        departmentRoleId: deptRole.id,
        workflowId: annualAppraisalWorkflow.id,
        rubricId: deptRole.defaultTemplateId ?? null,
        isActive: true,
      },
    });

    console.log(
      `  ✅ Assigned: ${deptRole.department?.name ?? "(no dept)"} — ${deptRole.role}` +
        (deptRole.defaultTemplateId ? " (with rubric)" : "")
    );
    created++;
  }

  // ── 3. Ensure all existing rubrics are marked as KPI_APPRAISAL ───────────
  console.log("\n📋 Confirming existing rubrics are marked as KPI_APPRAISAL...");

  const updateResult = await prisma.rubricTemplate.updateMany({
    where: {
      NOT: { templateType: "CLASSROOM_OBSERVATION" },
    },
    data: {
      templateType: "KPI_APPRAISAL",
    },
  });

  console.log(`  ✅ ${updateResult.count} rubric(s) updated/confirmed as KPI_APPRAISAL`);

  // ── 4. Summary report ─────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(55));
  console.log("🎉 Milestone 1 migration complete!");
  console.log(`   ✅ RoleWorkflowAssignments created : ${created}`);
  console.log(`   ⏭️  Already existed (skipped)      : ${skipped}`);
  console.log(`   📝 Rubrics updated to KPI_APPRAISAL: ${updateResult.count}`);
  console.log("=".repeat(55));

  const [totalWorkflows, totalAssignments, kpiRubrics, obsRubrics] =
    await Promise.all([
      prisma.workflowDefinition.count(),
      prisma.roleWorkflowAssignment.count(),
      prisma.rubricTemplate.count({ where: { templateType: "KPI_APPRAISAL" } }),
      prisma.rubricTemplate.count({ where: { templateType: "CLASSROOM_OBSERVATION" } }),
    ]);

  console.log("\n📊 Database state after migration:");
  console.log(`   WorkflowDefinitions        : ${totalWorkflows}`);
  console.log(`   RoleWorkflowAssignments    : ${totalAssignments}`);
  console.log(`   Rubrics (KPI_APPRAISAL)    : ${kpiRubrics}`);
  console.log(`   Rubrics (CLASSROOM_OBS)    : ${obsRubrics}`);
  console.log("\n✅ Milestone 1 is ready for verification!\n");
}

main()
  .catch((e) => {
    console.error("\n💥 Milestone 1 migration error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());