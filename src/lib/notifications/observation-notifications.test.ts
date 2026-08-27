import assert from "node:assert/strict";
import test from "node:test";
import {
  notifyManagerObservationAcknowledged,
  notifyManagerObservationReopened,
  notifyObservationAcknowledgementReminder,
  notifyObservationAutomaticallyAcknowledged,
  notifyObservationReassigned,
  notifyObservationSubmitted,
} from "./observation-notifications";
import {
  DEFAULT_OBSERVATION_NOTIFICATION_SETTINGS,
  OBSERVATION_NOTIFICATION_EVENT_POLICY,
  type ObservationNotificationEvent,
  type ObservationNotificationSettings,
} from "@/features/observations/server/notificationSettings";

const invocations: Record<ObservationNotificationEvent, (
  settings: ObservationNotificationSettings,
  sender: Parameters<typeof notifyObservationSubmitted>[7],
) => Promise<unknown>> = {
  submission: (settings, sender) =>
    notifyObservationSubmitted("staff", "staff@example.test", "Staff", "Manager", "Title", "id", settings, sender),
  reminder: (settings, sender) =>
    notifyObservationAcknowledgementReminder("staff", "staff@example.test", "Staff", "Manager", "Title", "id", settings, sender),
  personalAcknowledgement: (settings, sender) =>
    notifyManagerObservationAcknowledged("manager", "manager@example.test", "Staff", "Manager", "Title", "id", settings, sender),
  automaticAcknowledgement: (settings, sender) =>
    notifyObservationAutomaticallyAcknowledged("staff", "staff@example.test", "Staff", "Staff", "Manager", "Title", "id", settings, sender),
  reopen: (settings, sender) =>
    notifyManagerObservationReopened("manager", "manager@example.test", "Manager", "Staff", "Title", "Reason", "id", settings, sender),
  reassignment: (settings, sender) =>
    notifyObservationReassigned("manager", "manager@example.test", "Manager", "Staff", "Title", "id", true, settings, sender),
};

for (const event of Object.keys(invocations) as ObservationNotificationEvent[]) {
  test(`${event} observation email respects its global flag`, async () => {
    let deliveries = 0;
    const sender = async () => {
      deliveries += 1;
      return { success: true } as const;
    };
    const settingKey = OBSERVATION_NOTIFICATION_EVENT_POLICY[event];

    await invocations[event](DEFAULT_OBSERVATION_NOTIFICATION_SETTINGS, sender);
    assert.equal(deliveries, 1);

    await invocations[event](
      { ...DEFAULT_OBSERVATION_NOTIFICATION_SETTINGS, [settingKey]: false },
      sender,
    );
    assert.equal(deliveries, 1);
  });
}

test("the master switch suppresses every observation email", async () => {
  let deliveries = 0;
  const sender = async () => {
    deliveries += 1;
    return { success: true } as const;
  };
  const disabled = {
    ...DEFAULT_OBSERVATION_NOTIFICATION_SETTINGS,
    notificationsEnabled: false,
  };

  for (const invoke of Object.values(invocations)) {
    await invoke(disabled, sender);
  }
  assert.equal(deliveries, 0);
});

test("mandatory observation emails do not consult legacy user preferences", async () => {
  let deliveries = 0;
  const sender = async () => {
    deliveries += 1;
    return { success: true } as const;
  };

  for (const invoke of Object.values(invocations)) {
    await invoke(DEFAULT_OBSERVATION_NOTIFICATION_SETTINGS, sender);
  }
  assert.equal(deliveries, Object.keys(invocations).length);
});

test("manager acknowledgement email includes aggregate participant progress", async () => {
  let html = "";
  await notifyManagerObservationAcknowledged(
    "manager",
    "manager@example.test",
    "Participant",
    "Manager",
    "Title",
    "id",
    DEFAULT_OBSERVATION_NOTIFICATION_SETTINGS,
    async (message) => {
      html = message.html;
      return { success: true } as const;
    },
    { remaining: 2 },
  );

  assert.match(html, /2 participants still awaiting acknowledgement/);
});

test("automatic acknowledgement email is scoped to the affected participant", async () => {
  let html = "";
  await notifyObservationAutomaticallyAcknowledged(
    "staff",
    "staff@example.test",
    "Participant",
    "Participant",
    "Manager",
    "Title",
    "id",
    DEFAULT_OBSERVATION_NOTIFICATION_SETTINGS,
    async (message) => {
      html = message.html;
      return { success: true } as const;
    },
  );

  assert.match(html, /Your participation/);
  assert.doesNotMatch(html, /all participants/i);
});
