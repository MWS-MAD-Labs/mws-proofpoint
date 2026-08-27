import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-helpers";
import { getObservationSchedulerStatus } from "@/features/observations/server/observationSchedulerStatus";

export async function GET() {
  const { response } = await requireRole("admin");
  if (response) return response;

  try {
    const status = await getObservationSchedulerStatus();
    return NextResponse.json({ data: status });
  } catch (error) {
    console.error("Observation scheduler status GET error:", error);
    return NextResponse.json(
      { error: "Failed to load observation scheduler status." },
      { status: 500 },
    );
  }
}
