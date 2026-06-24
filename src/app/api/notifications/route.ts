import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getUserNotificationPreference,
  updateUserNotificationPreference,
  type UserNotificationPreference,
} from "@/lib/notifications/preferences";

type PreferenceUpdates = Partial<Omit<UserNotificationPreference, "userId">>;

const PREFERENCE_KEYS: Array<keyof PreferenceUpdates> = [
  "emailEnabled",
  "assessmentSubmitted",
  "managerReviewDone",
  "directorApproved",
  "adminReleased",
  "assessmentReturned",
  "assessmentAcknowledged",
];

function toApiShape(
  preferences: UserNotificationPreference,
): PreferenceUpdates {
  return {
    emailEnabled: preferences.emailEnabled,
    assessmentSubmitted: preferences.assessmentSubmitted,
    managerReviewDone: preferences.managerReviewDone,
    directorApproved: preferences.directorApproved,
    adminReleased: preferences.adminReleased,
    assessmentReturned: preferences.assessmentReturned,
    assessmentAcknowledged: preferences.assessmentAcknowledged,
  };
}

function extractPreferenceUpdates(body: unknown): PreferenceUpdates {
  const updates: PreferenceUpdates = {};

  if (!body || typeof body !== "object") {
    return updates;
  }

  const payload = body as Record<string, unknown>;

  for (const key of PREFERENCE_KEYS) {
    const value = payload[key];
    if (typeof value === "boolean") {
      updates[key] = value;
    }
  }

  return updates;
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const preferences = await getUserNotificationPreference(session.user.id);
    return NextResponse.json({ data: toApiShape(preferences) });
  } catch (error) {
    console.error("Notifications preferences GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch notification preferences" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const updates = extractPreferenceUpdates(body);

    if (Object.keys(updates).length > 0) {
      await updateUserNotificationPreference(session.user.id, updates);
    }

    const preferences = await getUserNotificationPreference(session.user.id);
    return NextResponse.json({ data: toApiShape(preferences) });
  } catch (error) {
    console.error("Notifications preferences PUT error:", error);
    return NextResponse.json(
      { error: "Failed to update notification preferences" },
      { status: 500 },
    );
  }
}
