import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

export async function GET(request: Request) {
  try {
    const adminCheck = await requireAdmin();
    if ("error" in adminCheck) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
    }

    const { searchParams } = new URL(request.url);
    const departmentRoleId = searchParams.get("departmentRoleId");

    const assignments = await prisma.roleWorkflowAssignment.findMany({
      where: departmentRoleId ? { departmentRoleId } : undefined,
      include: {
        workflow: { include: { steps: { orderBy: { stepOrder: "asc" } } } },
        rubric: { select: { id: true, name: true, templateType: true } },
        departmentRole: {
          include: {
            department: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ data: assignments });
  } catch (error) {
    console.error("Role workflow assignments error:", error);
    return NextResponse.json({ error: "Failed to fetch role workflow assignments" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const adminCheck = await requireAdmin();
    if ("error" in adminCheck) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
    }

    const body = await request.json();
    const { departmentRoleId, workflowId, rubricId } = body;

    if (!departmentRoleId || !workflowId) {
      return NextResponse.json(
        { error: "departmentRoleId and workflowId are required" },
        { status: 400 }
      );
    }

    const [departmentRole, workflow, rubric] = await Promise.all([
      prisma.departmentRole.findUnique({ where: { id: departmentRoleId } }),
      prisma.workflowDefinition.findUnique({ where: { id: workflowId } }),
      rubricId ? prisma.rubricTemplate.findUnique({ where: { id: rubricId } }) : Promise.resolve(null),
    ]);

    if (!departmentRole) {
      return NextResponse.json({ error: "Department role not found" }, { status: 404 });
    }

    if (!workflow) {
      return NextResponse.json({ error: "Workflow definition not found" }, { status: 404 });
    }

    if (rubricId && !rubric) {
      return NextResponse.json({ error: "Rubric template not found" }, { status: 404 });
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

    return NextResponse.json({ data: assignment }, { status: 201 });
  } catch (error) {
    console.error("Create role workflow assignment error:", error);
    return NextResponse.json({ error: "Failed to create role workflow assignment" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const adminCheck = await requireAdmin();
    if ("error" in adminCheck) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
    }

    const body = await request.json();
    const { id, rubricId, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: "Assignment ID is required" }, { status: 400 });
    }

    const existing = await prisma.roleWorkflowAssignment.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Role workflow assignment not found" }, { status: 404 });
    }

    if (rubricId) {
      const rubric = await prisma.rubricTemplate.findUnique({ where: { id: rubricId } });
      if (!rubric) {
        return NextResponse.json({ error: "Rubric template not found" }, { status: 404 });
      }
    }

    const assignment = await prisma.roleWorkflowAssignment.update({
      where: { id },
      data: {
        rubricId: rubricId !== undefined ? rubricId : existing.rubricId,
        isActive: typeof isActive === "boolean" ? isActive : existing.isActive,
      },
      include: {
        workflow: { include: { steps: { orderBy: { stepOrder: "asc" } } } },
        rubric: { select: { id: true, name: true, templateType: true } },
      },
    });

    return NextResponse.json({ data: assignment });
  } catch (error) {
    console.error("Update role workflow assignment error:", error);
    return NextResponse.json({ error: "Failed to update role workflow assignment" }, { status: 500 });
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
      return NextResponse.json({ error: "Assignment ID is required" }, { status: 400 });
    }

    await prisma.roleWorkflowAssignment.delete({ where: { id } });
    return NextResponse.json({ message: "Role workflow assignment deleted successfully" });
  } catch (error) {
    console.error("Delete role workflow assignment error:", error);
    return NextResponse.json({ error: "Failed to delete role workflow assignment" }, { status: 500 });
  }
}
