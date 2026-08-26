import type { ObservationNotificationSettings } from "./notificationSettings";

const DAY_MS = 24 * 60 * 60 * 1000;

type ReminderTiming = Pick<
  ObservationNotificationSettings,
  "firstReminderDays" | "reminderIntervalDays"
>;

type AutomaticAcknowledgementTiming = Pick<
  ObservationNotificationSettings,
  "automaticAcknowledgementDays"
>;

export function getObservationReminderPeriod(
  automationStartedAt: Date,
  now: Date,
  timing: ReminderTiming,
): number | null {
  const elapsedMs = now.getTime() - automationStartedAt.getTime();
  const firstReminderMs = timing.firstReminderDays * DAY_MS;
  if (elapsedMs < firstReminderMs) return null;

  const intervalMs = timing.reminderIntervalDays * DAY_MS;
  return Math.floor((elapsedMs - firstReminderMs) / intervalMs);
}

export function isAutomaticAcknowledgementDue(
  automationStartedAt: Date,
  now: Date,
  timing: AutomaticAcknowledgementTiming,
): boolean {
  const deadline =
    automationStartedAt.getTime() + timing.automaticAcknowledgementDays * DAY_MS;
  return now.getTime() >= deadline;
}
