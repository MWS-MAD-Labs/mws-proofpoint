import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-helpers";
import {
  getObservationNotificationSettings,
  observationNotificationSettingsUpdateSchema,
  updateObservationNotificationSettings,
} from "@/features/observations/server/notificationSettings";

interface ObservationNotificationSettingsRouteDependencies {
  authorize: typeof requireRole;
  readSettings: typeof getObservationNotificationSettings;
  updateSettings: typeof updateObservationNotificationSettings;
}

export function createObservationNotificationSettingsHandlers(
  dependencies: ObservationNotificationSettingsRouteDependencies = {
    authorize: requireRole,
    readSettings: getObservationNotificationSettings,
    updateSettings: updateObservationNotificationSettings,
  },
) {
  const GET = async () => {
    const { response } = await dependencies.authorize("admin");
    if (response) return response;

    try {
      const settings = await dependencies.readSettings();
      return NextResponse.json({ data: settings });
    } catch (error) {
      console.error("Observation notification settings GET error:", error);
      return NextResponse.json(
        { error: "Failed to load observation notification settings." },
        { status: 500 },
      );
    }
  };

  const PUT = async (request: Request) => {
    const { user, response } = await dependencies.authorize("admin");
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
      const settings = await dependencies.updateSettings(parsedBody.data, user!.id);
      return NextResponse.json({ data: settings });
    } catch (error) {
      console.error("Observation notification settings PUT error:", error);
      return NextResponse.json(
        { error: "Failed to update observation notification settings." },
        { status: 500 },
      );
    }
  };

  return { GET, PUT };
}
