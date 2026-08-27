import assert from "node:assert/strict";
import test from "node:test";
import { NextResponse } from "next/server";
import { createObservationNotificationSettingsHandlers } from "./handlers";
import { DEFAULT_OBSERVATION_NOTIFICATION_SETTINGS } from "@/features/observations/server/notificationSettings";

const validUpdate = {
  notificationsEnabled: true,
  submissionEmailsEnabled: true,
  reminderEmailsEnabled: true,
  firstReminderDays: 3,
  reminderIntervalDays: 2,
  automaticAcknowledgementEnabled: true,
  automaticAcknowledgementDays: 30,
  personalAcknowledgementEmailsEnabled: true,
  automaticAcknowledgementEmailsEnabled: true,
  reopenEmailsEnabled: true,
  reassignmentEmailsEnabled: true,
  schedulerEnabled: true,
  schedulerIntervalMinutes: 60,
};

function request(body: unknown) {
  return new Request("http://localhost/api/admin/observation-notification-settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("unauthenticated settings API request returns 401", async () => {
  const handlers = createObservationNotificationSettingsHandlers({
    authorize: async () => ({
      user: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }),
    readSettings: async () => DEFAULT_OBSERVATION_NOTIFICATION_SETTINGS,
    updateSettings: async () => DEFAULT_OBSERVATION_NOTIFICATION_SETTINGS,
  });

  assert.equal((await handlers.GET()).status, 401);
  assert.equal((await handlers.PUT(request(validUpdate))).status, 401);
});

test("authenticated non-admin settings API request returns 403", async () => {
  const handlers = createObservationNotificationSettingsHandlers({
    authorize: async () => ({
      user: null,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    }),
    readSettings: async () => DEFAULT_OBSERVATION_NOTIFICATION_SETTINGS,
    updateSettings: async () => DEFAULT_OBSERVATION_NOTIFICATION_SETTINGS,
  });

  assert.equal((await handlers.GET()).status, 403);
  assert.equal((await handlers.PUT(request(validUpdate))).status, 403);
});

test("admin can read and update settings", async () => {
  let actorId: string | null = null;
  const updated = {
    ...DEFAULT_OBSERVATION_NOTIFICATION_SETTINGS,
    ...validUpdate,
    schedulerIntervalMinutes: 15,
  };
  const handlers = createObservationNotificationSettingsHandlers({
    authorize: async () => ({ user: { id: "admin-1", roles: ["admin"] }, response: null }),
    readSettings: async () => updated,
    updateSettings: async (input, userId) => {
      actorId = userId;
      return { ...updated, ...input };
    },
  });

  const getResponse = await handlers.GET();
  assert.equal(getResponse.status, 200);
  assert.equal((await getResponse.json()).data.schedulerIntervalMinutes, 15);

  const putResponse = await handlers.PUT(request({ ...validUpdate, schedulerIntervalMinutes: 20 }));
  assert.equal(putResponse.status, 200);
  assert.equal((await putResponse.json()).data.schedulerIntervalMinutes, 20);
  assert.equal(actorId, "admin-1");
});

test("unknown, partial, invalid range, and invalid reminder deadline requests return 400", async () => {
  let updateCalls = 0;
  const handlers = createObservationNotificationSettingsHandlers({
    authorize: async () => ({ user: { id: "admin-1", roles: ["admin"] }, response: null }),
    readSettings: async () => DEFAULT_OBSERVATION_NOTIFICATION_SETTINGS,
    updateSettings: async () => {
      updateCalls += 1;
      return DEFAULT_OBSERVATION_NOTIFICATION_SETTINGS;
    },
  });
  const { reassignmentEmailsEnabled: _omitted, ...partial } = validUpdate;
  const invalidBodies = [
    { ...validUpdate, unknown: true },
    partial,
    { ...validUpdate, firstReminderDays: 0 },
    { ...validUpdate, reminderIntervalDays: 91 },
    { ...validUpdate, automaticAcknowledgementDays: 366 },
    { ...validUpdate, schedulerIntervalMinutes: 4 },
    { ...validUpdate, firstReminderDays: 30, automaticAcknowledgementDays: 30 },
  ];

  for (const body of invalidBodies) {
    assert.equal((await handlers.PUT(request(body))).status, 400);
  }
  assert.equal(updateCalls, 0);
});
