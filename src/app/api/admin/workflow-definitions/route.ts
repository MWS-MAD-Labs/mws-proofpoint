// src/app/api/admin/workflow-definitions/route.ts
// Milestone 2: API for Admin to manage workflow definitions
//
// Endpoints:
//   GET    /api/admin/workflow-definitions         → list all workflows
//   POST   /api/admin/workflow-definitions         → create a new workflow
//   PUT    /api/admin/workflow-definitions         → update an existing workflow
//   DELETE /api/admin/workflow-definitions?id=..  → delete a workflow

import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-helpers";

// ── GET: List all workflow definitions ────────────────────────────────────────
export async function GET() {
  const { response } = await requireRole("admin");
  if (response) return response;

  try {
    const workflows = await prisma.workflowDefinition.findMany({
      include: {
        steps: {
          orderBy: { stepOrder: "asc" },
        },
        assignments: {
          include: {
            departmentRole: {
              include: {
                department: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(workflows);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("GET /api/admin/workflow-definitions error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── POST: Create a new workflow ───────────────────────────────────────────────
export async function POST(req: Request) {
  const { response } = await requireRole("admin");
  if (response) return response;

  try {
    const body = await req.json();
    const { name, type, description, steps } = body;

    // Validate required fields
    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Workflow name is required." },
        { status: 400 }
      );
    }
    if (!type || !["KPI_APPRAISAL", "CLASSROOM_OBSERVATION", "GENERIC"].includes(type)) {
      return NextResponse.json(
        { error: "Invalid workflow type. Must be one of: KPI_APPRAISAL, CLASSROOM_OBSERVATION, GENERIC." },
        { status: 400 }
      );
    }

    // Validate steps if provided
    const validatedSteps = [];
    if (Array.isArray(steps)) {
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        if (!step.actorRole) {
          return NextResponse.json(
            { error: `Step ${i + 1}: actorRole is required.` },
            { status: 400 }
          );
        }
        if (!step.actionType || !["FILL_FORM", "ACKNOWLEDGE", "REVIEW", "APPROVE"].includes(step.actionType)) {
          return NextResponse.json(
            { error: `Step ${i + 1}: actionType is invalid.` },
            { status: 400 }
          );
        }
        validatedSteps.push({
          stepOrder:   i + 1,
          actorRole:   step.actorRole,
          actionType:  step.actionType,
          description: step.description ?? null,
        });
      }
    }

    const workflow = await prisma.workflowDefinition.create({
      data: {
        name:        name.trim(),
        type,
        description: description?.trim() ?? null,
        steps: {
          create: validatedSteps,
        },
      },
      include: {
        steps: { orderBy: { stepOrder: "asc" } },
      },
    });

    return NextResponse.json(workflow, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("POST /api/admin/workflow-definitions error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── PUT: Update an existing workflow ──────────────────────────────────────────
export async function PUT(req: Request) {
  const { response } = await requireRole("admin");
  if (response) return response;

  try {
    const body = await req.json();
    const { id, name, description, steps } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Workflow ID is required." },
        { status: 400 }
      );
    }

    // Check workflow exists
    const existing = await prisma.workflowDefinition.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Workflow not found." },
        { status: 404 }
      );
    }

    // Update inside a transaction: delete old steps, create new ones
    const updated = await prisma.$transaction(async (tx) => {
      // Delete all existing steps
      await tx.workflowStep.deleteMany({ where: { workflowId: id } });

      // Update workflow and create new steps
      return tx.workflowDefinition.update({
        where: { id },
        data: {
          name:        name?.trim() ?? existing.name,
          description: description?.trim() ?? existing.description,
          steps: {
            create: Array.isArray(steps)
              ? steps.map((s: any, i: number) => ({
                  stepOrder:   i + 1,
                  actorRole:   s.actorRole,
                  actionType:  s.actionType,
                  description: s.description ?? null,
                }))
              : [],
          },
        },
        include: {
          steps: { orderBy: { stepOrder: "asc" } },
        },
      });
    });

    return NextResponse.json(updated);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("PUT /api/admin/workflow-definitions error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── DELETE: Delete a workflow ─────────────────────────────────────────────────
export async function DELETE(req: Request) {
  const { response } = await requireRole("admin");
  if (response) return response;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Query parameter 'id' is required." },
        { status: 400 }
      );
    }

    // Check if any assignments still reference this workflow
    const assignmentCount = await prisma.roleWorkflowAssignment.count({
      where: { workflowId: id },
    });

    if (assignmentCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete workflow: it is still used by ${assignmentCount} role assignment(s). Remove those assignments first.`,
        },
        { status: 409 }
      );
    }

    await prisma.workflowDefinition.delete({ where: { id } });

    return NextResponse.json({ message: "Workflow deleted successfully." });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("DELETE /api/admin/workflow-definitions error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}