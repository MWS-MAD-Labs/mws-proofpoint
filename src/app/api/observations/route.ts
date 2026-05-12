// src/app/api/observations/route.ts

import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { notifyObservationCreated } from "@/lib/notifications/observation-notifications";
import { randomUUID } from "crypto";

// ── GET /api/observations ─────────────────────────────────────────────────────
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = { id: session.user.id, roles: (session.user as any).roles ?? [] };

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const isAdmin    = user.roles.includes("admin");
  const isDirector = user.roles.includes("director");
  const isManager  = user.roles.includes("manager");

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
          select: { id: true, email: true, profile: { select: { fullName: true } } },
        },
        users_observations_managerIdTousers: {
          select: { id: true, email: true, profile: { select: { fullName: true } } },
        },
        rubric_templates: { select: { id: true, name: true } },
        answers: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Transform Prisma relation names → friendly field names
    const mapped = observations.map((obs: any) => ({
      ...obs,
      staff:   obs.users_observations_staffIdTousers   ?? null,
      manager: obs.users_observations_managerIdTousers ?? null,
      rubric:  obs.rubric_templates                    ?? null,
      // remove raw prisma keys to keep response clean
      users_observations_staffIdTousers:   undefined,
      users_observations_managerIdTousers: undefined,
      rubric_templates:                    undefined,
    }));

    return NextResponse.json(mapped);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("GET /api/observations error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── POST /api/observations ────────────────────────────────────────────────────
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = { id: session.user.id, roles: (session.user as any).roles ?? [] };

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

    const staff = await prisma.user.findUnique({
      where: { id: staffId },
      include: { profile: true },
    });
    if (!staff) {
      return NextResponse.json({ error: "Staff member not found." }, { status: 404 });
    }

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

    // AC2: reject KPI_APPRAISAL rubrics for observations
    if (rubric.templateType === "KPI_APPRAISAL") {
      return NextResponse.json(
        { error: "Cannot use a KPI Appraisal rubric for an observation. Please select an Observation Form or Generic template." },
        { status: 400 }
      );
    }

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