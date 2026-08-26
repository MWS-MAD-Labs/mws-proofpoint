import { query, queryOne } from "@/lib/db";
import type { ObservationAutomationResult } from "./processAcknowledgementAutomation";
import type { ObservationNotificationSettings } from "./notificationSettings";

const STATUS_ID = 1;
const MAX_ERROR_LENGTH = 2_000;

interface SchedulerStatusRow {
  lastAttemptedAt: Date | string | null;
  lastSuccessfulAt: Date | string | null;
  settingsRevision: Date | string | null;
  nextExpectedAt: Date | string | null;
  advisoryLockSkips: number;
  checked: number;
  reminded: number;
  autoAcknowledged: number;
  skipped: number;
  failed: number;
  lastError: string | null;
}

export interface ObservationSchedulerStatus {
  lastAttemptedAt: string | null;
  lastSuccessfulAt: string | null;
  settingsRevision: string | null;
  nextExpectedAt: string | null;
  advisoryLockSkips: number;
  counts: {
    checked: number;
    reminded: number;
    autoAcknowledged: number;
    skipped: number;
    failed: number;
  };
  lastError: string | null;
}

function iso(value: Date | string | null): string | null {
  return value ? new Date(value).toISOString() : null;
}

function serializeStatus(row: SchedulerStatusRow): ObservationSchedulerStatus {
  return {
    lastAttemptedAt: iso(row.lastAttemptedAt),
    lastSuccessfulAt: iso(row.lastSuccessfulAt),
    settingsRevision: iso(row.settingsRevision),
    nextExpectedAt: iso(row.nextExpectedAt),
    advisoryLockSkips: row.advisoryLockSkips,
    counts: {
      checked: row.checked,
      reminded: row.reminded,
      autoAcknowledged: row.autoAcknowledged,
      skipped: row.skipped,
      failed: row.failed,
    },
    lastError: row.lastError,
  };
}

function nextExpectedAt(attemptedAt: Date, settings: ObservationNotificationSettings): Date {
  return new Date(attemptedAt.getTime() + settings.schedulerIntervalMinutes * 60 * 1000);
}

function errorSummary(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, MAX_ERROR_LENGTH);
}

export async function getObservationSchedulerStatus(): Promise<ObservationSchedulerStatus> {
  const row = await queryOne<SchedulerStatusRow>(
    `SELECT last_attempted_at AS "lastAttemptedAt",
            last_successful_at AS "lastSuccessfulAt",
            settings_revision AS "settingsRevision",
            next_expected_at AS "nextExpectedAt",
            advisory_lock_skips AS "advisoryLockSkips",
            checked,
            reminded,
            auto_acknowledged AS "autoAcknowledged",
            skipped,
            failed,
            last_error AS "lastError"
       FROM observation_acknowledgement_scheduler_status
      WHERE id = $1`,
    [STATUS_ID],
  );

  return serializeStatus(
    row ?? {
      lastAttemptedAt: null,
      lastSuccessfulAt: null,
      settingsRevision: null,
      nextExpectedAt: null,
      advisoryLockSkips: 0,
      checked: 0,
      reminded: 0,
      autoAcknowledged: 0,
      skipped: 0,
      failed: 0,
      lastError: null,
    },
  );
}

export async function recordObservationSchedulerPolicySkip(
  attemptedAt: Date,
  settings: ObservationNotificationSettings,
): Promise<void> {
  await query(
    `INSERT INTO observation_acknowledgement_scheduler_status
       (id, last_attempted_at, settings_revision, next_expected_at, skipped, updated_at)
     VALUES ($1, $2, $3, $4, 1, CURRENT_TIMESTAMP)
     ON CONFLICT (id) DO UPDATE
       SET last_attempted_at = EXCLUDED.last_attempted_at,
           settings_revision = EXCLUDED.settings_revision,
           next_expected_at = EXCLUDED.next_expected_at,
           checked = 0,
           reminded = 0,
           auto_acknowledged = 0,
           skipped = 1,
           failed = 0,
           last_error = NULL,
           updated_at = CURRENT_TIMESTAMP`,
    [STATUS_ID, attemptedAt, settings.updatedAt, nextExpectedAt(attemptedAt, settings)],
  );
}

export async function recordObservationSchedulerLockSkip(
  attemptedAt: Date,
  settings: ObservationNotificationSettings,
): Promise<void> {
  await query(
    `INSERT INTO observation_acknowledgement_scheduler_status
       (id, last_attempted_at, settings_revision, next_expected_at, advisory_lock_skips, updated_at)
     VALUES ($1, $2, $3, $4, 1, CURRENT_TIMESTAMP)
     ON CONFLICT (id) DO UPDATE
       SET last_attempted_at = EXCLUDED.last_attempted_at,
           settings_revision = EXCLUDED.settings_revision,
           next_expected_at = EXCLUDED.next_expected_at,
           advisory_lock_skips = observation_acknowledgement_scheduler_status.advisory_lock_skips + 1,
           updated_at = CURRENT_TIMESTAMP`,
    [STATUS_ID, attemptedAt, settings.updatedAt, nextExpectedAt(attemptedAt, settings)],
  );
}

export async function recordObservationSchedulerSuccess(
  attemptedAt: Date,
  settings: ObservationNotificationSettings,
  result: ObservationAutomationResult,
): Promise<void> {
  const skipped = result.remindersSkipped + result.automaticAcknowledgementsSkipped;
  const completedWithoutErrors = result.errors === 0;
  const partialError = completedWithoutErrors
    ? null
    : `${result.errors} observation automation item${result.errors === 1 ? "" : "s"} failed; review application logs.`;
  await query(
    `INSERT INTO observation_acknowledgement_scheduler_status
       (id, last_attempted_at, last_successful_at, settings_revision, next_expected_at,
        checked, reminded, auto_acknowledged, skipped, failed, last_error, updated_at)
     VALUES ($1, $2, CASE WHEN $10 THEN CURRENT_TIMESTAMP ELSE NULL END, $3, $4, $5, $6, $7, $8, $9, $11, CURRENT_TIMESTAMP)
     ON CONFLICT (id) DO UPDATE
       SET last_attempted_at = EXCLUDED.last_attempted_at,
           last_successful_at = CASE
             WHEN $10 THEN CURRENT_TIMESTAMP
             ELSE observation_acknowledgement_scheduler_status.last_successful_at
           END,
           settings_revision = EXCLUDED.settings_revision,
           next_expected_at = EXCLUDED.next_expected_at,
           checked = EXCLUDED.checked,
           reminded = EXCLUDED.reminded,
           auto_acknowledged = EXCLUDED.auto_acknowledged,
           skipped = EXCLUDED.skipped,
           failed = EXCLUDED.failed,
           last_error = EXCLUDED.last_error,
           updated_at = CURRENT_TIMESTAMP`,
    [
      STATUS_ID,
      attemptedAt,
      settings.updatedAt,
      nextExpectedAt(attemptedAt, settings),
      result.checked,
      result.remindersSent,
      result.automaticallyAcknowledged,
      skipped,
      result.errors,
      completedWithoutErrors,
      partialError,
    ],
  );
}

export async function recordObservationSchedulerFailure(
  attemptedAt: Date,
  settings: ObservationNotificationSettings | null,
  error: unknown,
): Promise<void> {
  const nextExpected = settings ? nextExpectedAt(attemptedAt, settings) : null;
  await query(
    `INSERT INTO observation_acknowledgement_scheduler_status
       (id, last_attempted_at, settings_revision, next_expected_at, failed, last_error, updated_at)
     VALUES ($1, $2, $3, $4, 1, $5, CURRENT_TIMESTAMP)
     ON CONFLICT (id) DO UPDATE
       SET last_attempted_at = EXCLUDED.last_attempted_at,
           settings_revision = EXCLUDED.settings_revision,
           next_expected_at = EXCLUDED.next_expected_at,
           checked = 0,
           reminded = 0,
           auto_acknowledged = 0,
           skipped = 0,
           failed = 1,
           last_error = EXCLUDED.last_error,
           updated_at = CURRENT_TIMESTAMP`,
    [STATUS_ID, attemptedAt, settings?.updatedAt ?? null, nextExpected, errorSummary(error)],
  );
}
