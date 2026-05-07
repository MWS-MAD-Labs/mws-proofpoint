// src/app/api/observations/answer/route.ts
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-helpers";
import { randomUUID } from "crypto";

export async function POST(req: Request) {
  // Only the assigned manager or admin can fill in answers
  const { user, response } = await requireRole("manager", "admin");
  if (response) return response;

  const isAdmin = user!.roles.includes("admin");

  const body = await req.json().catch(() => ({}));
  const { observationId, indicatorId, score, note, evidence } = body;

  if (!observationId || !indicatorId || score === undefined) {
    return NextResponse.json(
      { error: "observationId, indicatorId, and score are required." },
      { status: 400 }
    );
  }

  // Score must be a number between 0 and 100
  const numScore = Number(score);
  if (isNaN(numScore) || numScore < 0 || numScore > 100) {
    return NextResponse.json(
      { error: "Score must be a number between 0 and 100." },
      { status: 400 }
    );
  }

  const observation = await prisma.observation.findUnique({
    where: { id: observationId },
  });

  if (!observation) {
    return NextResponse.json(
      { error: "Observation not found." },
      { status: 404 }
    );
  }

  // Manager can only fill in observations assigned to them
  if (!isAdmin && observation.managerId !== user!.id) {
    return NextResponse.json(
      { error: "Forbidden. You can only fill in observations assigned to you." },
      { status: 403 }
    );
  }

  // Answers can only be changed while the observation is still in draft
  if (observation.status !== "draft") {
    return NextResponse.json(
      { error: "Answers cannot be changed after the observation has been submitted." },
      { status: 400 }
    );
  }

  // Validate that the indicator belongs to the correct rubric
  const indicator = await prisma.rubricIndicator.findFirst({
    where: {
      id: indicatorId,
      section: { templateId: observation.rubricId },
    },
  });

  if (!indicator) {
    return NextResponse.json(
      { error: "Indicator is invalid or does not belong to this rubric." },
      { status: 400 }
    );
  }

  // Upsert using unique constraint [observationId, indicatorId]
  const result = await prisma.observationAnswer.upsert({
    where: {
      observationId_indicatorId: { observationId, indicatorId },
    },
    update: {
      score:    numScore,
      note:     note     ?? "",
      evidence: evidence ?? null,
    },
    create: {
      id:           randomUUID(),
      observationId,
      indicatorId,
      score:        numScore,
      note:         note     ?? "",
      evidence:     evidence ?? null,
    },
  });

  return NextResponse.json(result);
}