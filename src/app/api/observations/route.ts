// src/app/api/observations/route.ts

import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth-helpers";
import { notifyObservationCreated } from "@/lib/notifications/observation-notifications";
import { randomUUID } from "crypto";

// ── GET /api/observations ─────────────────────────────────────────────────────
// Returns observations filtered by the logged-in user's role:
//   Admin & Director → all observations
//   Manager          → observations assigned to them (managerId)
//   Staff            → their own observations (staffId)

export async function GET(req: Request) {
  const { user, response } = await requireAuth();
  if (response) return response;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const isAdmin    = user!.roles.includes("admin");
  const isDirector = user!.roles.includes("director");
  const isManager  = user!.roles.includes("manager");

  const roleFilter =
    isAdmin || isDirector
      ? {}
      : isManager
      ? { managerId: user!.id }
      : { staffId: user!.id };

  try {
    const observations = await prisma.observation.findMany({
      where: {
        ...roleFilter,
        ...(status ? { status: status as any } : {}),
      },
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
        rubric_templates: { select: { id: true, name: true } },
        answers: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(observations);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("GET /api/observations error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── POST /api/observations ────────────────────────────────────────────────────
// Create a new observation.
// Both Admin and Manager can create observations.
//
// Rules:
//   Admin   → can assign any manager (or defaults to self)
//   Manager → managerId is always set to themselves

export async function POST(req: Request) {
  const { user, response } = await requireRole("admin", "manager");
  if (response) return response;

  const isAdmin = user!.roles.includes("admin");

  try {
    const body = await req.json().catch(() => ({}));

    const staffId  = body.staffId?.trim();
    const rubricId = body.rubricId?.trim();

    const managerId = isAdmin
      ? (body.managerId?.trim() || user!.id)
      : user!.id;

    if (!staffId || !rubricId) {
      return NextResponse.json(
        { error: "staffId and rubricId are required." },
        { status: 400 }
      );
    }

    // Verify staff exists
    const staff = await prisma.user.findUnique({
      where: { id: staffId },
      include: { profile: true },
    });
    if (!staff) {
      return NextResponse.json({ error: "Staff member not found." }, { status: 404 });
    }

    // Validate manager (only when Admin selects a different manager)
    if (isAdmin && managerId !== user!.id) {
      const managerUser = await prisma.user.findUnique({
        where: { id: managerId },
        include: { roles: true },
      });
      if (!managerUser) {
        return NextResponse.json({ error: "Manager not found." }, { status: 404 });
      }
      const managerRoles = managerUser.roles.map((r) => r.role as string);
      if (!managerRoles.includes("manager") && !managerRoles.includes("admin")) {
        return NextResponse.json(
          { error: "The selected user does not have the manager role." },
          { status: 400 }
        );
      }
    }

    // Verify rubric exists and fetch sections + indicators
    const rubric = await prisma.rubricTemplate.findUnique({
      where: { id: rubricId },
      include: {
        sections: {
          orderBy: { sortOrder: "asc" },
          include: { indicators: { orderBy: { sortOrder: "asc" } } },
        },
      },
    });
    if (!rubric) {
      return NextResponse.json({ error: "Rubric not found." }, { status: 404 });
    }

    // Create observation + pre-create empty answer rows (in a transaction)
    const observation = await prisma.$transaction(async (tx) => {
      const obs = await tx.observation.create({
        data: {
          id:          randomUUID(),
          staffId,
          managerId,
          rubricId,
          status:      "draft",
          type:        "MANAGER",
          title:       `Observation — ${staff.profile?.fullName || staff.email}`,
          description: "",
        },
      });

      const answerRows = rubric.sections.flatMap((section) =>
        section.indicators.map((indicator) => ({
          id:            randomUUID(),
          observationId: obs.id,
          indicatorId:   indicator.id,
          score:         0,
          note:          "",
        }))
      );

      if (answerRows.length > 0) {
        await tx.observationAnswer.createMany({
          data:           answerRows,
          skipDuplicates: true,
        });
      }

      return obs;
    });

    // Send email notification to the assigned manager
    const assignedManager = await prisma.user.findUnique({
      where:   { id: managerId },
      include: { profile: true },
    });

    if (assignedManager) {
      await notifyObservationCreated(
        assignedManager.email,
        staff.profile?.fullName || staff.email,
        rubric.name,
        observation.id
      ).catch((err: unknown) => console.error("Notification email error:", err));
    }

    return NextResponse.json(observation, { status: 201 });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("POST /api/observations error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}