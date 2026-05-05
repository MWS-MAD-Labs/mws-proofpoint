// src/app/api/observations/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireAuth();
    if (response) return response;

    const { id } = await params;

    const observation = await prisma.observation.findUnique({
      where: { id },
      include: {
        users_observations_staffIdTousers: {
          select: {
            id:      true,
            email:   true,
            profile: { select: { fullName: true } },
          },
        },
        users_observations_managerIdTousers: {
          select: {
            id:      true,
            email:   true,
            profile: { select: { fullName: true } },
          },
        },
        rubric_templates: {
          include: {
            sections: {
              orderBy: { sortOrder: "asc" },
              include: {
                indicators: { orderBy: { sortOrder: "asc" } },
              },
            },
          },
        },
        answers: true,
        updates: {
          include: {
            updatedBy: {
              select: {
                id:      true,
                email:   true,
                profile: { select: { fullName: true } },
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!observation) {
      return NextResponse.json(
        { error: "Observation not found." },
        { status: 404 }
      );
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

    return NextResponse.json(observation);
  } catch (error: any) {
    console.error("GET /api/observations/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}