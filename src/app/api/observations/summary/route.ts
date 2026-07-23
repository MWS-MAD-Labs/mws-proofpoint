import { NextResponse } from "next/server";
import { getObservationSession } from "@/features/observations/server/auth";
import { queryObservationSummary } from "@/features/observations/server/queries";

export async function GET() {
  const session = await getObservationSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const actor = {
    id: session.user.id,
    roles: (session.user as { roles?: string[] }).roles ?? [],
  };

  try {
    return NextResponse.json(await queryObservationSummary(actor));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("GET /api/observations/summary error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
