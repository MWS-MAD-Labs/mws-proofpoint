import type { PoolClient } from "pg";
import { pool } from "@/lib/db";
import {
  DEFAULT_OBSERVATION_NOTIFICATION_SETTINGS,
  DEFAULT_OBSERVATION_SCHEDULER_INTERVAL_MINUTES,
  getObservationNotificationSettings,
  getObservationSchedulerIntervalMs,
  type ObservationNotificationSettings,
} from "./notificationSettings";
import { processObservationAcknowledgementAutomation } from "./processAcknowledgementAutomation";
import {
  recordObservationSchedulerFailure,
  recordObservationSchedulerLockSkip,
  recordObservationSchedulerPolicySkip,
  recordObservationSchedulerSuccess,
} from "./observationSchedulerStatus";

export const OBSERVATION_SCHEDULER_ADVISORY_LOCK = {
  namespace: 1_347_436_354,
  key: 1_094_929_201,
} as const;
const INITIAL_DELAY_MS = 30 * 1000;
const FALLBACK_INTERVAL_MS =
  DEFAULT_OBSERVATION_SCHEDULER_INTERVAL_MINUTES * 60 * 1000;

type SchedulerGlobal = typeof globalThis & {
  __proofPointObservationAcknowledgementSchedulerStarted?: boolean;
  __proofPointObservationAcknowledgementSchedulerTimer?: NodeJS.Timeout;
};

export interface ObservationSchedulerConfig {
  enabled: boolean;
  intervalMs: number;
  initialDelayMs: number;
}

export function getObservationSchedulerConfig(
  settings: Pick<
    ObservationNotificationSettings,
    "notificationsEnabled" | "schedulerEnabled" | "schedulerIntervalMinutes"
  > | null = DEFAULT_OBSERVATION_NOTIFICATION_SETTINGS,
): ObservationSchedulerConfig {
  return {
    enabled: Boolean(settings?.notificationsEnabled && settings.schedulerEnabled),
    intervalMs: getObservationSchedulerIntervalMs(settings),
    initialDelayMs: INITIAL_DELAY_MS,
  };
}

type SettingsReader = typeof getObservationNotificationSettings;
type AutomationProcessor = typeof processObservationAcknowledgementAutomation;

export interface ObservationSchedulerRunOptions {
  processAutomation?: AutomationProcessor;
  readSettings?: SettingsReader;
  recordFailure?: typeof recordObservationSchedulerFailure;
  recordLockSkip?: typeof recordObservationSchedulerLockSkip;
  recordPolicySkip?: typeof recordObservationSchedulerPolicySkip;
  recordSuccess?: typeof recordObservationSchedulerSuccess;
}

export async function runObservationAcknowledgementSchedulerOnce(
  processAutomationOrOptions: AutomationProcessor | ObservationSchedulerRunOptions =
    processObservationAcknowledgementAutomation,
): Promise<"completed" | "skipped" | "failed"> {
  const options: ObservationSchedulerRunOptions =
    typeof processAutomationOrOptions === "function"
      ? { processAutomation: processAutomationOrOptions }
      : processAutomationOrOptions;
  const processAutomation =
    options.processAutomation ?? processObservationAcknowledgementAutomation;
  const readSettings = options.readSettings ?? getObservationNotificationSettings;
  const recordFailure = options.recordFailure ?? recordObservationSchedulerFailure;
  const recordLockSkip = options.recordLockSkip ?? recordObservationSchedulerLockSkip;
  const recordPolicySkip = options.recordPolicySkip ?? recordObservationSchedulerPolicySkip;
  const recordSuccess = options.recordSuccess ?? recordObservationSchedulerSuccess;
  const attemptedAt = new Date();
  let settings: ObservationNotificationSettings | null = null;
  let client: PoolClient | null = null;
  let lockAcquired = false;

  try {
    settings = await readSettings();
    if (!settings.notificationsEnabled) {
      await recordPolicySkip(attemptedAt, settings);
      console.log(
        "[Observation scheduler] Skipping run because observation notifications are disabled.",
      );
      return "skipped";
    }
    if (!settings.schedulerEnabled) {
      await recordPolicySkip(attemptedAt, settings);
      console.log(
        "[Observation scheduler] Skipping run because acknowledgement scheduling is disabled.",
      );
      return "skipped";
    }

    client = await pool.connect();
    const lockResult = await client.query<{ acquired: boolean }>(
      `SELECT pg_try_advisory_lock($1, $2) AS acquired`,
      [
        OBSERVATION_SCHEDULER_ADVISORY_LOCK.namespace,
        OBSERVATION_SCHEDULER_ADVISORY_LOCK.key,
      ],
    );
    lockAcquired = lockResult.rows[0]?.acquired === true;
    if (!lockAcquired) {
      await recordLockSkip(attemptedAt, settings);
      console.log(
        "[Observation scheduler] Another application instance is processing acknowledgements; skipping this run.",
      );
      return "skipped";
    }

    const result = await processAutomation(attemptedAt, { settings });
    await recordSuccess(attemptedAt, settings, result);
    console.log("[Observation scheduler] Run completed:", {
      settingsRevision: settings.updatedAt,
      nextExpectedAt: new Date(
        attemptedAt.getTime() + settings.schedulerIntervalMinutes * 60 * 1000,
      ).toISOString(),
      ...result,
    });
    return "completed";
  } catch (error) {
    try {
      await recordFailure(attemptedAt, settings, error);
    } catch (statusError) {
      console.error("[Observation scheduler] Failed to record scheduler failure:", statusError);
    }
    console.error("[Observation scheduler] Run failed:", error);
    return "failed";
  } finally {
    if (client && lockAcquired) {
      try {
        await client.query(`SELECT pg_advisory_unlock($1, $2)`, [
          OBSERVATION_SCHEDULER_ADVISORY_LOCK.namespace,
          OBSERVATION_SCHEDULER_ADVISORY_LOCK.key,
        ]);
      } catch (error) {
        console.error("[Observation scheduler] Failed to release advisory lock:", error);
      }
    }
    client?.release();
  }
}

export function startObservationAcknowledgementScheduler(): void {
  const schedulerGlobal = globalThis as SchedulerGlobal;
  if (schedulerGlobal.__proofPointObservationAcknowledgementSchedulerStarted) {
    return;
  }
  schedulerGlobal.__proofPointObservationAcknowledgementSchedulerStarted = true;

  const readNextIntervalMs = async (): Promise<number> => {
    try {
      const settings = await getObservationNotificationSettings();
      return getObservationSchedulerIntervalMs(settings);
    } catch (error) {
      console.error(
        "[Observation scheduler] Failed to read the next interval; retrying in 60 minutes:",
        error,
      );
      return FALLBACK_INTERVAL_MS;
    }
  };

  const scheduleNextRun = (delayMs: number) => {
    const timer = setTimeout(async () => {
      try {
        await runObservationAcknowledgementSchedulerOnce();
      } catch (error) {
        console.error("[Observation scheduler] Unexpected run failure:", error);
      } finally {
        const nextIntervalMs = await readNextIntervalMs();
        scheduleNextRun(nextIntervalMs);
      }
    }, delayMs);
    timer.unref();
    schedulerGlobal.__proofPointObservationAcknowledgementSchedulerTimer = timer;
  };

  scheduleNextRun(INITIAL_DELAY_MS);
  console.log(
    `[Observation scheduler] Started; first settings-aware run in ${Math.round(INITIAL_DELAY_MS / 1000)} seconds.`,
  );
}
