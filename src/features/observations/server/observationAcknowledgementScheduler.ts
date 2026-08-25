import type { PoolClient } from "pg";
import { pool } from "@/lib/db";
import { positiveInteger } from "./acknowledgementAutomationConfig";
import { processObservationAcknowledgementAutomation } from "./processAcknowledgementAutomation";

export const OBSERVATION_SCHEDULER_ADVISORY_LOCK = {
  namespace: 1_347_436_354,
  key: 1_094_929_201,
} as const;
const DEFAULT_INTERVAL_MINUTES = 60;
const DEFAULT_INITIAL_DELAY_SECONDS = 30;

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
  env: Readonly<Record<string, string | undefined>> = process.env,
): ObservationSchedulerConfig {
  return {
    enabled: env.OBSERVATION_ACK_SCHEDULER_ENABLED !== "false",
    intervalMs:
      positiveInteger(
        env.OBSERVATION_ACK_SCHEDULER_INTERVAL_MINUTES,
        DEFAULT_INTERVAL_MINUTES,
      ) *
      60 *
      1000,
    initialDelayMs:
      positiveInteger(
        env.OBSERVATION_ACK_SCHEDULER_INITIAL_DELAY_SECONDS,
        DEFAULT_INITIAL_DELAY_SECONDS,
      ) * 1000,
  };
}

export async function runObservationAcknowledgementSchedulerOnce(
  processAutomation = processObservationAcknowledgementAutomation,
): Promise<"completed" | "skipped" | "failed"> {
  let client: PoolClient | null = null;
  let lockAcquired = false;

  try {
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
      console.log(
        "[Observation scheduler] Another application instance is processing acknowledgements; skipping this run.",
      );
      return "skipped";
    }

    const result = await processAutomation();
    console.log("[Observation scheduler] Run completed:", result);
    return "completed";
  } catch (error) {
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
  const config = getObservationSchedulerConfig();
  if (!config.enabled) {
    console.log("[Observation scheduler] Disabled by configuration.");
    return;
  }

  const schedulerGlobal = globalThis as SchedulerGlobal;
  if (schedulerGlobal.__proofPointObservationAcknowledgementSchedulerStarted) {
    return;
  }
  schedulerGlobal.__proofPointObservationAcknowledgementSchedulerStarted = true;

  const scheduleNextRun = (delayMs: number) => {
    const timer = setTimeout(async () => {
      try {
        await runObservationAcknowledgementSchedulerOnce();
      } finally {
        scheduleNextRun(config.intervalMs);
      }
    }, delayMs);
    timer.unref();
    schedulerGlobal.__proofPointObservationAcknowledgementSchedulerTimer = timer;
  };

  scheduleNextRun(config.initialDelayMs);
  console.log(
    `[Observation scheduler] Started; first run in ${Math.round(config.initialDelayMs / 1000)} seconds, then every ${Math.round(config.intervalMs / 60000)} minutes.`,
  );
}
