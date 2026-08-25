export function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export const observationAcknowledgementTiming = {
  firstReminderDays: positiveInteger(
    process.env.OBSERVATION_ACK_FIRST_REMINDER_DAYS,
    3,
  ),
  reminderIntervalDays: positiveInteger(
    process.env.OBSERVATION_ACK_REMINDER_INTERVAL_DAYS,
    2,
  ),
  automaticAcknowledgementDays: positiveInteger(
    process.env.OBSERVATION_AUTO_ACK_DAYS,
    30,
  ),
} as const;

export function getObservationReminderPeriod(
  automationStartedAt: Date,
  now: Date,
): number | null {
  const elapsedMs = now.getTime() - automationStartedAt.getTime();
  const firstReminderMs =
    observationAcknowledgementTiming.firstReminderDays * 24 * 60 * 60 * 1000;
  if (elapsedMs < firstReminderMs) return null;

  const intervalMs =
    observationAcknowledgementTiming.reminderIntervalDays * 24 * 60 * 60 * 1000;
  return Math.floor((elapsedMs - firstReminderMs) / intervalMs);
}

export function isAutomaticAcknowledgementDue(
  automationStartedAt: Date,
  now: Date,
): boolean {
  const deadline =
    automationStartedAt.getTime() +
    observationAcknowledgementTiming.automaticAcknowledgementDays *
      24 *
      60 *
      60 *
      1000;
  return now.getTime() >= deadline;
}
