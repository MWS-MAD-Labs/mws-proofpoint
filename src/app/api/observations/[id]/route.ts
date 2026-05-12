// src/app/api/observations/[id]/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = { id: session.user.id, roles: (session.user as any).roles ?? [] };

    const { id } = await params;

    const observation = await prisma.observation.findUnique({
      where: { id },
      include: {
        users_observations_staffIdTousers: {
          select: { id: true, email: true, profile: { select: { fullName: true } } },
        },
        users_observations_managerIdTousers: {
          select: { id: true, email: true, profile: { select: { fullName: true } } },
        },
        rubric_templates: {
          include: {
            sections: {
              orderBy: { sortOrder: "asc" },
              include: { indicators: { orderBy: { sortOrder: "asc" } } },
            },
          },
        },
        answers: true,
        updates: {
          include: {
            updatedBy: {
              select: { id: true, email: true, profile: { select: { fullName: true } } },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!observation) {
      return NextResponse.json({ error: "Observation not found." }, { status: 404 });
    }

    const isAdmin        = user!.roles.includes("admin");
    const isDirector     = user!.roles.includes("director");
    const isOwnerManager = observation.managerId === user!.id;
    const isOwnerStaff   = observation.staffId   === user!.id;

    if (!isAdmin && !isDirector && !isOwnerManager && !isOwnerStaff) {
      return NextResponse.json(
        { error: "Forbidden. You do not have access to this observation." },
        { status: 403 }
      );
    }

    // Transform Prisma relation names → friendly field names
    const mapped: any = {
      ...observation,
      staff:   (observation as any).users_observations_staffIdTousers   ?? null,
      manager: (observation as any).users_observations_managerIdTousers ?? null,
      rubric:  (observation as any).rubric_templates                    ?? null,
      users_observations_staffIdTousers:   undefined,
      users_observations_managerIdTousers: undefined,
      rubric_templates:                    undefined,
    };

    return NextResponse.json(mapped);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("GET /api/observations/[id] error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}