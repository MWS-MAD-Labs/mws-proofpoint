import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_WORKFLOW_TYPES = ["KPI_APPRAISAL", "CLASSROOM_OBSERVATION", "GENERIC"] as const;
const VALID_ACTION_TYPES = ["FILL_FORM", "ACKNOWLEDGE", "REVIEW", "APPROVE"] as const;
const VALID_ACTOR_ROLES = ["admin", "staff", "manager", "director", "supervisor"] as const;

type WorkflowType = (typeof VALID_WORKFLOW_TYPES)[number];
type WorkflowActionType = (typeof VALID_ACTION_TYPES)[number];
type ActorRole = (typeof VALID_ACTOR_ROLES)[number];

interface WorkflowStepInput {
  actorRole?: string;
  actionType?: string;
  description?: string | null;
}

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized", status: 401 };
  }

  const roles = (session.user as { roles?: string[] }).roles ?? [];
  if (!roles.includes("admin")) {
    return { error: "Forbidden", status: 403 };
  }

  return { session };
}

function isWorkflowType(value: string): value is WorkflowType {
  return VALID_WORKFLOW_TYPES.includes(value as WorkflowType);
}

function isWorkflowActionType(value: string): value is WorkflowActionType {
  return VALID_ACTION_TYPES.includes(value as WorkflowActionType);
}

function isActorRole(value: string): value is ActorRole {
  return VALID_ACTOR_ROLES.includes(value as ActorRole);
}

function validateSteps(steps: unknown) {
  if (steps === undefined) return [];
  if (!Array.isArray(steps)) {
    return { error: "steps must be an array." };
  }

  const validatedSteps = [];

  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index] as WorkflowStepInput;

    if (!step.actorRole || !isActorRole(step.actorRole)) {
      return { error: `Step ${index + 1}: actorRole is invalid.` };
    }

    if (!step.actionType || !isWorkflowActionType(step.actionType)) {
      return { error: `Step ${index + 1}: actionType is invalid.` };
    }

    validatedSteps.push({
      stepOrder: index + 1,
      actorRole: step.actorRole,
      actionType: step.actionType,
      description: step.description ?? null,
    });
  }

  return validatedSteps;
}

export async function GET() {
  try {
    const adminCheck = await requireAdmin();
    if ("error" in adminCheck) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
    }

    const workflows = await prisma.workflowDefinition.findMany({
      include: {
        steps: { orderBy: { stepOrder: "asc" } },
        assignments: {
          include: {
            departmentRole: {
              include: {
                department: { select: { id: true, name: true } },
              },
            },
            rubric: { select: { id: true, name: true, templateType: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: workflows });
  } catch (error) {
    console.error("Workflow definitions error:", error);
    return NextResponse.json({ error: "Failed to fetch workflow definitions" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const adminCheck = await requireAdmin();
    if ("error" in adminCheck) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
    }

    const body = await request.json();
    const { name, type, description, steps } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Workflow name is required" }, { status: 400 });
    }

    if (!type || typeof type !== "string" || !isWorkflowType(type)) {
      return NextResponse.json({ error: "Invalid workflow type" }, { status: 400 });
    }

    const validatedSteps = validateSteps(steps);
    if (!Array.isArray(validatedSteps)) {
      return NextResponse.json({ error: validatedSteps.error }, { status: 400 });
    }

    const workflow = await prisma.workflowDefinition.create({
      data: {
        name: name.trim(),
        type,
        description: typeof description === "string" && description.trim() ? description.trim() : null,
        steps: { create: validatedSteps },
      },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    });

    return NextResponse.json({ data: workflow }, { status: 201 });
  } catch (error) {
    console.error("Create workflow definition error:", error);
    return NextResponse.json({ error: "Failed to create workflow definition" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const adminCheck = await requireAdmin();
    if ("error" in adminCheck) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
    }

    const body = await request.json();
    const { id, name, description, steps } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Workflow ID is required" }, { status: 400 });
    }

    const existing = await prisma.workflowDefinition.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Workflow definition not found" }, { status: 404 });
    }

    const validatedSteps = validateSteps(steps);
    if (!Array.isArray(validatedSteps)) {
      return NextResponse.json({ error: validatedSteps.error }, { status: 400 });
    }

    const workflow = await prisma.$transaction(async (tx) => {
      if (steps !== undefined) {
        await tx.workflowStep.deleteMany({ where: { workflowId: id } });
      }

      return tx.workflowDefinition.update({
        where: { id },
        data: {
          name: typeof name === "string" && name.trim() ? name.trim() : existing.name,
          description:
            typeof description === "string" ? description.trim() || null : existing.description,
          steps: steps !== undefined ? { create: validatedSteps } : undefined,
        },
        include: { steps: { orderBy: { stepOrder: "asc" } } },
      });
    });

    return NextResponse.json({ data: workflow });
  } catch (error) {
    console.error("Update workflow definition error:", error);
    return NextResponse.json({ error: "Failed to update workflow definition" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const adminCheck = await requireAdmin();
    if ("error" in adminCheck) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Workflow ID is required" }, { status: 400 });
    }

    await prisma.workflowDefinition.delete({ where: { id } });
    return NextResponse.json({ message: "Workflow definition deleted successfully" });
  } catch (error) {
    console.error("Delete workflow definition error:", error);
    return NextResponse.json({ error: "Failed to delete workflow definition" }, { status: 500 });
  }
}
