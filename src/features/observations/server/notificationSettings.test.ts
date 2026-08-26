import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_OBSERVATION_NOTIFICATION_SETTINGS,
  getObservationSchedulerIntervalMs,
  isObservationNotificationEventEnabled,
  observationNotificationSettingsUpdateSchema,
} from "./notificationSettings";

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

test("notification settings schema requires a strict full update", () => {
  assert.equal(observationNotificationSettingsUpdateSchema.safeParse(validUpdate).success, true);
  assert.equal(
    observationNotificationSettingsUpdateSchema.safeParse({
      ...validUpdate,
      unexpected: true,
    }).success,
    false,
  );
  assert.equal(
    observationNotificationSettingsUpdateSchema.safeParse({
      ...validUpdate,
      schedulerIntervalMinutes: 4,
    }).success,
    false,
  );

  const { reassignmentEmailsEnabled: _omitted, ...partialUpdate } = validUpdate;
  assert.equal(
    observationNotificationSettingsUpdateSchema.safeParse(partialUpdate).success,
    false,
  );
});

test("reminder deadline must follow the first reminder when reminders are enabled", () => {
  assert.equal(
    observationNotificationSettingsUpdateSchema.safeParse({
      ...validUpdate,
      firstReminderDays: 30,
      automaticAcknowledgementDays: 30,
    }).success,
    false,
  );
  assert.equal(
    observationNotificationSettingsUpdateSchema.safeParse({
      ...validUpdate,
      reminderEmailsEnabled: false,
      firstReminderDays: 30,
      automaticAcknowledgementDays: 30,
    }).success,
    true,
  );
});

test("event policy honors the master switch and event-specific switch", () => {
  assert.equal(
    isObservationNotificationEventEnabled(
      DEFAULT_OBSERVATION_NOTIFICATION_SETTINGS,
      "submission",
    ),
    true,
  );
  assert.equal(
    isObservationNotificationEventEnabled(
      {
        ...DEFAULT_OBSERVATION_NOTIFICATION_SETTINGS,
        notificationsEnabled: false,
      },
      "submission",
    ),
    false,
  );
  assert.equal(
    isObservationNotificationEventEnabled(
      {
        ...DEFAULT_OBSERVATION_NOTIFICATION_SETTINGS,
        reminderEmailsEnabled: false,
      },
      "reminder",
    ),
    false,
  );
});

test("scheduler interval uses valid settings or the safe 60 minute fallback", () => {
  assert.equal(getObservationSchedulerIntervalMs({ schedulerIntervalMinutes: 15 }), 15 * 60 * 1000);
  assert.equal(getObservationSchedulerIntervalMs(), 60 * 60 * 1000);
  assert.equal(
    getObservationSchedulerIntervalMs({ schedulerIntervalMinutes: Number.NaN }),
    60 * 60 * 1000,
  );
});
