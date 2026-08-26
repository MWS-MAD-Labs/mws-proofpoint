import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-helpers";
import {
  getObservationNotificationSettings,
  observationNotificationSettingsUpdateSchema,
  updateObservationNotificationSettings,
} from "@/features/observations/server/notificationSettings";

export async function GET() {
  const { response } = await requireRole("admin");
  if (response) return response;

  try {
    const settings = await getObservationNotificationSettings();
    return NextResponse.json({ data: settings });
  } catch (error) {
    console.error("Observation notification settings GET error:", error);
    return NextResponse.json(
      { error: "Failed to load observation notification settings." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const { user, response } = await requireRole("admin");
  if (response) return response;

  const parsedBody = observationNotificationSettingsUpdateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsedBody.success) {
    return NextResponse.json(
      {
        error: "Invalid observation notification settings.",
        details: parsedBody.error.flatten(),
      },
      { status: 400 },
    );
  }

  try {
    const settings = await updateObservationNotificationSettings(
      parsedBody.data,
      user!.id,
    );
    return NextResponse.json({ data: settings });
  } catch (error) {
    console.error("Observation notification settings PUT error:", error);
    return NextResponse.json(
      { error: "Failed to update observation notification settings." },
      { status: 500 },
    );
  }
}
