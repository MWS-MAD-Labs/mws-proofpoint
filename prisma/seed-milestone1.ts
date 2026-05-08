import { PrismaClient } from "@prisma/client";
import { createPrismaClient } from "./prisma-client.js";

const prisma = createPrismaClient();

export async function seedMilestone1(
  client: PrismaClient = prisma,
): Promise<void> {
  console.log("Running Milestone 1 workflow data migration...");

  let annualAppraisalWorkflow = await client.workflowDefinition.findFirst({
    where: { name: "Annual Appraisal", type: "KPI_APPRAISAL" },
    include: { steps: true },
  });

  if (!annualAppraisalWorkflow) {
    annualAppraisalWorkflow = await client.workflowDefinition.create({
      data: {
        name: "Annual Appraisal",
        type: "KPI_APPRAISAL",
        description:
          "Standard annual appraisal workflow: staff self-assessment, manager review, director approval, and staff acknowledgement.",
        steps: {
          create: [
            {
              stepOrder: 1,
              actorRole: "staff",
              actionType: "FILL_FORM",
              description: "Staff completes self-assessment.",
            },
            {
              stepOrder: 2,
              actorRole: "manager",
              actionType: "REVIEW",
              description: "Manager reviews and scores the appraisal.",
            },
            {
              stepOrder: 3,
              actorRole: "director",
              actionType: "APPROVE",
              description: "Director approves the appraisal result.",
            },
            {
              stepOrder: 4,
              actorRole: "staff",
              actionType: "ACKNOWLEDGE",
              description: "Staff acknowledges the appraisal result.",
            },
          ],
        },
      },
      include: { steps: true },
    });

    console.log(`Created workflow definition: ${annualAppraisalWorkflow.name}`);
  } else if (annualAppraisalWorkflow.steps.length === 0) {
    await client.workflowStep.createMany({
      data: [
        {
          workflowId: annualAppraisalWorkflow.id,
          stepOrder: 1,
          actorRole: "staff",
          actionType: "FILL_FORM",
          description: "Staff completes self-assessment.",
        },
        {
          workflowId: annualAppraisalWorkflow.id,
          stepOrder: 2,
          actorRole: "manager",
          actionType: "REVIEW",
          description: "Manager reviews and scores the appraisal.",
        },
        {
          workflowId: annualAppraisalWorkflow.id,
          stepOrder: 3,
          actorRole: "director",
          actionType: "APPROVE",
          description: "Director approves the appraisal result.",
        },
        {
          workflowId: annualAppraisalWorkflow.id,
          stepOrder: 4,
          actorRole: "staff",
          actionType: "ACKNOWLEDGE",
          description: "Staff acknowledges the appraisal result.",
        },
      ],
    });

    console.log(
      `Created default steps for workflow definition: ${annualAppraisalWorkflow.name}`,
    );
  }

  const departmentRoles = await client.departmentRole.findMany({
    select: {
      id: true,
      role: true,
      defaultTemplateId: true,
      department: { select: { name: true } },
    },
  });

  let createdAssignments = 0;
  let skippedAssignments = 0;

  for (const departmentRole of departmentRoles) {
    const existingAssignment = await client.roleWorkflowAssignment.findFirst({
      where: {
        departmentRoleId: departmentRole.id,
        workflowId: annualAppraisalWorkflow.id,
      },
    });

    if (existingAssignment) {
      skippedAssignments += 1;
      continue;
    }

    await client.roleWorkflowAssignment.create({
      data: {
        departmentRoleId: departmentRole.id,
        workflowId: annualAppraisalWorkflow.id,
        rubricId: departmentRole.defaultTemplateId,
        isActive: true,
      },
    });

    createdAssignments += 1;
  }

  const updatedRubrics = await client.rubricTemplate.updateMany({
    where: {
      NOT: { templateType: "CLASSROOM_OBSERVATION" },
    },
    data: { templateType: "KPI_APPRAISAL" },
  });

  console.log(
    `Milestone 1 seed complete. Created assignments: ${createdAssignments}. ` +
      `Skipped existing assignments: ${skippedAssignments}. ` +
      `Rubrics confirmed as KPI Appraisal: ${updatedRubrics.count}.`,
  );
}

if (process.argv[1]?.endsWith("seed-milestone1.ts")) {
  seedMilestone1()
    .catch((error) => {
      console.error("Milestone 1 seed failed:", error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
