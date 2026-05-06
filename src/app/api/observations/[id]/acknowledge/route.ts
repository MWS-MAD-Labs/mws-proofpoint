// src/app/api/observations/[id]/acknowledge/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { notifyObservationAcknowledged } from "@/lib/notifications/observation-notifications";
import { randomUUID } from "crypto";

export async function PATCH(
  // ✅ FIX: request tidak dipakai — prefix _ agar tidak error noUnusedParameters
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireAuth();
    if (response) return response;

    const { id } = await params;
    const isAdmin = user!.roles.includes("admin");

    const observation = await prisma.observation.findUnique({
      where: { id },
      include: {
        users_observations_staffIdTousers:   { include: { profile: true } },
        users_observations_managerIdTousers: { include: { profile: true } },
        rubric_templates: true,
      },
    });

    if (!observation) {
      return NextResponse.json({ error: "Observation not found." }, { status: 404 });
    }

    const staff   = observation.users_observations_staffIdTousers;
    const manager = observation.users_observations_managerIdTousers;
    const rubric  = observation.rubric_templates;

    if (observation.status !== "submitted") {
      return NextResponse.json(
        { error: "Observation must have status 'submitted' before it can be acknowledged." },
        { status: 400 }
      );
    }

    if (!isAdmin && observation.staffId !== user!.id) {
      return NextResponse.json(
        { error: "Forbidden. You can only acknowledge your own observations." },
        { status: 403 }
      );
    }

    const updated = await prisma.observation.update({
      where: { id },
      data: {
        status:         "acknowledged",
        acknowledgedAt: new Date(),
        acknowledgedBy: user!.id,
      },
    });

    await prisma.observationUpdate.create({
      data: {
        id:            randomUUID(),
        observationId: id,
        updatedById:   user!.id,
        statusFrom:    "submitted",
        statusTo:      "acknowledged",
        notes:         `Acknowledged by ${isAdmin ? "admin" : "staff"}`,
      },
    }).catch((err: unknown) => console.error("ObservationUpdate error:", err));

    const adminUser = await prisma.user.findFirst({
      where: { roles: { some: { role: "admin" } } },
    });

    if (adminUser) {
      await notifyObservationAcknowledged(
        adminUser.email,
        staff.profile?.fullName  ?? staff.email,
        manager?.profile?.fullName ?? manager?.email ?? "Manager",
        rubric?.name ?? "Observation",
        updated.id
      ).catch((err: unknown) => console.error("Acknowledge email notification error:", err));
    }

    return NextResponse.json(updated);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("PATCH /api/observations/[id]/acknowledge error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}