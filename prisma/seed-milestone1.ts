// prisma/seed-milestone1.ts
// Data migration untuk Milestone 1:
//   - Buat WorkflowDefinition "Annual Appraisal"
//   - Assign ke semua DepartmentRole yang ada
//   - Pastikan semua rubric non-observation bertipe KPI_APPRAISAL
//
// Standalone : npx tsx prisma/seed-milestone1.ts
// Via seed.ts : import { seedMilestone1 } from "./seed-milestone1.js"

import { PrismaClient } from "@prisma/client";
import { createPrismaClient } from "./prisma-client.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);

// ✅ FIX: dikonversi jadi export function agar bisa dipanggil dari seed.ts
//         menggunakan PrismaClient yang diterima sebagai parameter (konsisten)
export async function seedMilestone1(prisma: PrismaClient): Promise<void> {
  console.log("\n🚀 [seed-milestone1] Milestone 1 workflow migration...\n");

  // ── 1. Buat "Annual Appraisal" WorkflowDefinition jika belum ada ──────────
  let annualAppraisalWorkflow = await prisma.workflowDefinition.findFirst({
    where: { name: "Annual Appraisal" },
  });

  if (!annualAppraisalWorkflow) {
    annualAppraisalWorkflow = await prisma.workflowDefinition.create({
      data: {
        name:        "Annual Appraisal",
        type:        "KPI_APPRAISAL",
        description: "Standard annual appraisal: staff self-assessment → manager review → director approval → acknowledgement",
        steps: {
          create: [
            { stepOrder: 1, actorRole: "staff",    actionType: "FILL_FORM",   description: "Staff fills in self-assessment" },
            { stepOrder: 2, actorRole: "manager",  actionType: "REVIEW",      description: "Manager performs review and scoring" },
            { stepOrder: 3, actorRole: "director", actionType: "APPROVE",     description: "Director approves the appraisal result" },
            { stepOrder: 4, actorRole: "staff",    actionType: "ACKNOWLEDGE", description: "Staff acknowledges the appraisal result" },
          ],
        },
      },
    });
    console.log(`✅ WorkflowDefinition dibuat: "Annual Appraisal" (id: ${annualAppraisalWorkflow.id})`);
  } else {
    console.log(`⏭️  WorkflowDefinition sudah ada: "Annual Appraisal" (id: ${annualAppraisalWorkflow.id})`);
  }

  // ── 2. Assign ke semua DepartmentRole yang belum punya assignment ─────────
  const departmentRoles = await prisma.departmentRole.findMany({
    include: { department: { select: { name: true } } },
  });

  console.log(`\n📋 Ditemukan ${departmentRoles.length} DepartmentRole...`);

  let created = 0;
  let skipped = 0;

  for (const deptRole of departmentRoles) {
    const existing = await prisma.roleWorkflowAssignment.findFirst({
      where: {
        departmentRoleId: deptRole.id,
        workflowId:       annualAppraisalWorkflow.id,
      },
    });

    if (existing) {
      console.log(`  ⏭️  Skip: ${deptRole.department?.name ?? "(global)"} — ${deptRole.role}`);
      skipped++;
      continue;
    }

    await prisma.roleWorkflowAssignment.create({
      data: {
        departmentRoleId: deptRole.id,
        workflowId:       annualAppraisalWorkflow.id,
        rubricId:         deptRole.defaultTemplateId ?? null,
        isActive:         true,
      },
    });

    console.log(
      `  ✅ Assigned: ${deptRole.department?.name ?? "(global)"} — ${deptRole.role}` +
      (deptRole.defaultTemplateId ? " (with rubric)" : "")
    );
    created++;
  }

  // ── 3. Pastikan rubric non-observation bertipe KPI_APPRAISAL ─────────────
  console.log("\n📋 Memastikan rubric non-observation bertipe KPI_APPRAISAL...");

  const updateResult = await prisma.rubricTemplate.updateMany({
    where: { NOT: { templateType: "CLASSROOM_OBSERVATION" } },
    data:  { templateType: "KPI_APPRAISAL" },
  });

  console.log(`  ✅ ${updateResult.count} rubric diupdate/dikonfirmasi sebagai KPI_APPRAISAL`);

  // ── 4. Summary ────────────────────────────────────────────────────────────
  const [totalWorkflows, totalAssignments, kpiRubrics, obsRubrics] =
    await Promise.all([
      prisma.workflowDefinition.count(),
      prisma.roleWorkflowAssignment.count(),
      prisma.rubricTemplate.count({ where: { templateType: "KPI_APPRAISAL" } }),
      prisma.rubricTemplate.count({ where: { templateType: "CLASSROOM_OBSERVATION" } }),
    ]);

  console.log("\n🎉 [seed-milestone1] Selesai!");
  console.log(`   ✅ RoleWorkflowAssignments dibuat : ${created}`);
  console.log(`   ⏭️  Sudah ada (skip)              : ${skipped}`);
  console.log(`   📝 Rubrics KPI_APPRAISAL          : ${kpiRubrics}`);
  console.log(`   📝 Rubrics CLASSROOM_OBSERVATION  : ${obsRubrics}`);
  console.log(`   📊 Total WorkflowDefinitions      : ${totalWorkflows}`);
  console.log(`   📊 Total Assignments               : ${totalAssignments}\n`);
}

// ── Standalone runner ──────────────────────────────────────────────────────────
const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);

if (isMain) {
  const prisma = createPrismaClient();
  seedMilestone1(prisma)
    .catch((e) => { console.error("💥 Fatal error:", e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}