import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { processObservationAcknowledgementAutomation } from "@/features/observations/server/processAcknowledgementAutomation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authorization = request.headers.get("authorization");
  const supplied = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : request.headers.get("x-cron-secret");
  if (!supplied) return false;

  const expectedBuffer = Buffer.from(secret);
  const suppliedBuffer = Buffer.from(supplied);
  return (
    expectedBuffer.length === suppliedBuffer.length &&
    timingSafeEqual(expectedBuffer, suppliedBuffer)
  );
}

async function run(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processObservationAcknowledgementAutomation();
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("Observation acknowledgement cron failed:", error);
    return NextResponse.json(
      { error: "Observation acknowledgement automation failed" },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
