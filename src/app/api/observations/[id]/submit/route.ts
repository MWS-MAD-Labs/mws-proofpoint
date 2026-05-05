// src/app/api/observations/[id]/submit/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { notifyObservationSubmitted } from "@/lib/notifications/observation-notifications";
import { randomUUID } from "crypto";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireRole("manager", "admin");
    if (response) return response;

    const { id } = await params;
    const isAdmin = user!.roles.includes("admin");

    const observation = await prisma.observation.findUnique({
      where: { id },
      include: {
        answers: true,
        users_observations_staffIdTousers: {
          include: { profile: true },
        },
        users_observations_managerIdTousers: {
          include: { profile: true },
        },
        rubric_templates: true,
      },
    });

    if (!observation) {
      return NextResponse.json({ error: "Observation not found." }, { status: 404 });
    }

    const staff   = observation.users_observations_staffIdTousers;
    const manager = observation.users_observations_managerIdTousers;
    const rubric  = observation.rubric_templates;

    if (!isAdmin && observation.managerId !== user!.id) {
      return NextResponse.json(
        { error: "Forbidden. You can only submit observations assigned to you." },
        { status: 403 }
      );
    }

    if (observation.status !== "draft") {
      return NextResponse.json(
        { error: "Only observations with status 'draft' can be submitted." },
        { status: 400 }
      );
    }

    const filledAnswers = observation.answers.filter((a) => a.score > 0);
    if (filledAnswers.length === 0) {
      return NextResponse.json(
        { error: "Please fill in at least one indicator before submitting." },
        { status: 400 }
      );
    }

    const updated = await prisma.observation.update({
      where: { id },
      data: { status: "submitted", submittedAt: new Date() },
    });

    await prisma.observationUpdate.create({
      data: {
        id:            randomUUID(),
        observationId: id,
        updatedById:   user!.id,
        statusFrom:    "draft",
        statusTo:      "submitted",
        notes:         `Submitted by ${isAdmin ? "admin" : "manager"}`,
      },
    }).catch((err: unknown) => console.error("ObservationUpdate error:", err));

    await notifyObservationSubmitted(
      staff.email,
      staff.profile?.fullName || staff.email,
      rubric?.name || "Observation",
      updated.id
    ).catch((err: unknown) => console.error("Submit email notification error:", err));

    return NextResponse.json(updated);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("PATCH /api/observations/[id]/submit error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}