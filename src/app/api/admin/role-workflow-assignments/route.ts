// src/app/api/admin/role-workflow-assignments/route.ts
// CRUD for assigning a WorkflowDefinition to a DepartmentRole (with optional rubric)
//
// GET    /api/admin/role-workflow-assignments?departmentRoleId=  → list assignments for a role
// POST   /api/admin/role-workflow-assignments                    → create assignment
// PUT    /api/admin/role-workflow-assignments                    → update assignment (rubric / isActive)
// DELETE /api/admin/role-workflow-assignments?id=               → delete assignment

import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-helpers";

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  const { response } = await requireRole("admin");
  if (response) return response;

  const { searchParams } = new URL(req.url);
  const departmentRoleId = searchParams.get("departmentRoleId");

  try {
    const assignments = await prisma.roleWorkflowAssignment.findMany({
      where: departmentRoleId ? { departmentRoleId } : undefined,
      include: {
        workflow: {
          include: {
            steps: { orderBy: { stepOrder: "asc" } },
          },
        },
        rubric: { select: { id: true, name: true, templateType: true } },
        departmentRole: {
          include: {
            department: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(assignments);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("GET /api/admin/role-workflow-assignments error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  const { response } = await requireRole("admin");
  if (response) return response;

  try {
    const body = await req.json();
    const { departmentRoleId, workflowId, rubricId } = body;

    if (!departmentRoleId || !workflowId) {
      return NextResponse.json(
        { error: "departmentRoleId and workflowId are required." },
        { status: 400 }
      );
    }

    // Verify department role exists
    const deptRole = await prisma.departmentRole.findUnique({ where: { id: departmentRoleId } });
    if (!deptRole) {
      return NextResponse.json({ error: "Department role not found." }, { status: 404 });
    }

    // Verify workflow exists
    const workflow = await prisma.workflowDefinition.findUnique({ where: { id: workflowId } });
    if (!workflow) {
      return NextResponse.json({ error: "Workflow definition not found." }, { status: 404 });
    }

    // Verify rubric exists if provided
    if (rubricId) {
      const rubric = await prisma.rubricTemplate.findUnique({ where: { id: rubricId } });
      if (!rubric) {
        return NextResponse.json({ error: "Rubric template not found." }, { status: 404 });
      }
    }

    const assignment = await prisma.roleWorkflowAssignment.create({
      data: {
        departmentRoleId,
        workflowId,
        rubricId: rubricId ?? null,
        isActive: true,
      },
      include: {
        workflow: { include: { steps: { orderBy: { stepOrder: "asc" } } } },
        rubric: { select: { id: true, name: true, templateType: true } },
      },
    });

    return NextResponse.json(assignment, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("POST /api/admin/role-workflow-assignments error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── PUT ───────────────────────────────────────────────────────────────────────
export async function PUT(req: Request) {
  const { response } = await requireRole("admin");
  if (response) return response;

  try {
    const body = await req.json();
    const { id, rubricId, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: "Assignment ID is required." }, { status: 400 });
    }

    const existing = await prisma.roleWorkflowAssignment.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Assignment not found." }, { status: 404 });
    }

    const updated = await prisma.roleWorkflowAssignment.update({
      where: { id },
      data: {
        rubricId: rubricId !== undefined ? (rubricId ?? null) : existing.rubricId,
        isActive:  isActive  !== undefined ? isActive             : existing.isActive,
      },
      include: {
        workflow: { include: { steps: { orderBy: { stepOrder: "asc" } } } },
        rubric: { select: { id: true, name: true, templateType: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("PUT /api/admin/role-workflow-assignments error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── DELETE ────────────────────────────────────────────────────────────────────
export async function DELETE(req: Request) {
  const { response } = await requireRole("admin");
  if (response) return response;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Query parameter 'id' is required." }, { status: 400 });
    }

    const existing = await prisma.roleWorkflowAssignment.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Assignment not found." }, { status: 404 });
    }

    await prisma.roleWorkflowAssignment.delete({ where: { id } });
    return NextResponse.json({ message: "Assignment deleted successfully." });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("DELETE /api/admin/role-workflow-assignments error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}