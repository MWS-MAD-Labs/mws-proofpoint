import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth-helpers";
import { listObservationNotificationSettingsAudit } from "@/features/observations/server/notificationSettings";

const historyQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().refine((value) => [10, 20, 50].includes(value)).default(10),
});

export async function GET(request: Request) {
  const { response } = await requireRole("admin");
  if (response) return response;

  const url = new URL(request.url);
  const parsedQuery = historyQuerySchema.safeParse({
    page: url.searchParams.get("page") ?? undefined,
    pageSize: url.searchParams.get("pageSize") ?? undefined,
  });
  if (!parsedQuery.success) {
    return NextResponse.json(
      { error: "Invalid audit history pagination.", details: parsedQuery.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await listObservationNotificationSettingsAudit(
      parsedQuery.data.page,
      parsedQuery.data.pageSize,
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error("Observation notification settings history GET error:", error);
    return NextResponse.json(
      { error: "Failed to load observation notification settings history." },
      { status: 500 },
    );
  }
}
