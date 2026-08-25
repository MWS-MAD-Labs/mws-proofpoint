import { randomUUID } from "node:crypto";
import { pool, query } from "@/lib/db";
import type { EmailResult } from "@/lib/email";
import {
  notifyObservationAcknowledgementReminder,
  notifyObservationAutomaticallyAcknowledged,
} from "@/lib/notifications/observation-notifications";
import {
  getObservationReminderPeriod,
  isAutomaticAcknowledgementDue,
} from "./acknowledgementAutomationConfig";

const AUTOMATIC_ACKNOWLEDGEMENT_NOTE =
  "Automatically acknowledged because the staff response deadline passed. The staff member did not personally acknowledge this observation.";

interface PendingObservationRow {
  id: string;
  staffId: string;
  managerId: string | null;
  staffEmail: string;
  staffName: string | null;
  managerEmail: string | null;
  managerName: string | null;
  observationTitle: string;
  submittedAt: Date;
  automationStartedAt: Date;
}

export interface ObservationAutomationResult {
  checked: number;
  remindersSent: number;
  remindersSkipped: number;
  automaticallyAcknowledged: number;
  automaticAcknowledgementsSkipped: number;
  errors: number;
}

interface ObservationAutomationOptions {
  observationIds?: string[];
  sendReminder?: typeof notifyObservationAcknowledgementReminder;
  sendAutomaticAcknowledgement?: typeof notifyObservationAutomaticallyAcknowledged;
  afterReminderClaim?: (
    observationId: string,
    submissionAt: Date,
    reminderPeriod: number,
  ) => Promise<void>;
  beforeAutomaticAcknowledgement?: (
    observationId: string,
    submissionAt: Date,
  ) => Promise<void>;
}

export async function processObservationAcknowledgementAutomation(
  now = new Date(),
  options: ObservationAutomationOptions = {},
): Promise<ObservationAutomationResult> {
  const observationIds = options.observationIds?.length
    ? options.observationIds
    : null;
  const observations = await query<PendingObservationRow>(
    `SELECT
       o.id,
       o."staffId" AS "staffId",
       o."managerId" AS "managerId",
       su.email AS "staffEmail",
       sp.full_name AS "staffName",
       mu.email AS "managerEmail",
       mp.full_name AS "managerName",
       COALESCE(NULLIF(BTRIM(o.title), ''), rt.name, 'Observation') AS "observationTitle",
       o.submitted_at AS "submittedAt",
       o.acknowledgement_automation_started_at AS "automationStartedAt"
     FROM observations o
     JOIN users su ON su.id = o."staffId"
     LEFT JOIN profiles sp ON sp.user_id = su.id
     LEFT JOIN users mu ON mu.id = o."managerId"
     LEFT JOIN profiles mp ON mp.user_id = mu.id
     LEFT JOIN rubric_templates rt ON rt.id = o.template_id
     WHERE o.status = 'submitted'
       AND o.acknowledged_at IS NULL
       AND o.submitted_at IS NOT NULL
       AND o.acknowledgement_automation_started_at IS NOT NULL
       AND ($1::uuid[] IS NULL OR o.id = ANY($1::uuid[]))
     ORDER BY o.acknowledgement_automation_started_at ASC
     LIMIT 500`,
    [observationIds],
  );

  const result: ObservationAutomationResult = {
    checked: observations.length,
    remindersSent: 0,
    remindersSkipped: 0,
    automaticallyAcknowledged: 0,
    automaticAcknowledgementsSkipped: 0,
    errors: 0,
  };

  for (const observation of observations) {
    try {
      if (isAutomaticAcknowledgementDue(observation.automationStartedAt, now)) {
        await options.beforeAutomaticAcknowledgement?.(
          observation.id,
          observation.submittedAt,
        );
        const acknowledged = await automaticallyAcknowledgeObservation(
          observation,
          now,
          options.sendAutomaticAcknowledgement ??
            notifyObservationAutomaticallyAcknowledged,
        );
        if (acknowledged) result.automaticallyAcknowledged += 1;
        else result.automaticAcknowledgementsSkipped += 1;
        continue;
      }

      const reminderPeriod = getObservationReminderPeriod(
        observation.automationStartedAt,
        now,
      );
      if (reminderPeriod === null) continue;

      const claimed = await claimReminder(observation, reminderPeriod);
      if (!claimed) {
        result.remindersSkipped += 1;
        continue;
      }

      await options.afterReminderClaim?.(
        observation.id,
        observation.submittedAt,
        reminderPeriod,
      );

      const reminderStatus = await sendClaimedReminder(
        observation,
        reminderPeriod,
        options.sendReminder ?? notifyObservationAcknowledgementReminder,
      );
      if (reminderStatus === "sent") {
        result.remindersSent += 1;
      } else if (reminderStatus === "failed") {
        result.errors += 1;
      } else {
        result.remindersSkipped += 1;
      }
    } catch (error) {
      result.errors += 1;
      console.error(
        `[Observation automation] Failed for observation ${observation.id}:`,
        error,
      );
    }
  }

  return result;
}

async function claimReminder(
  observation: PendingObservationRow,
  reminderPeriod: number,
): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `INSERT INTO observation_acknowledgement_reminders
       (id, observation_id, submission_at, reminder_period, status, created_at)
     VALUES ($1, $2, $3, $4, 'processing', NOW())
     ON CONFLICT (observation_id, submission_at, reminder_period) DO UPDATE
       SET status = 'processing', error = NULL, sent_at = NULL, created_at = NOW()
       WHERE observation_acknowledgement_reminders.status = 'failed'
          OR (
            observation_acknowledgement_reminders.status = 'processing'
            AND observation_acknowledgement_reminders.created_at < NOW() - INTERVAL '1 hour'
          )
     RETURNING id`,
    [randomUUID(), observation.id, observation.submittedAt, reminderPeriod],
  );
  return Boolean(rows[0]);
}

async function sendClaimedReminder(
  observation: PendingObservationRow,
  reminderPeriod: number,
  sendReminder: (
    staffUserId: string,
    staffEmail: string,
    staffName: string,
    managerName: string,
    observationTitle: string,
    observationId: string,
  ) => Promise<EmailResult>,
): Promise<"sent" | "skipped" | "failed"> {
  const eligible = await query<{ eligible: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM observations
       WHERE id = $1
         AND status = 'submitted'
         AND acknowledged_at IS NULL
         AND submitted_at = $2
         AND acknowledgement_automation_started_at IS NOT NULL
     ) AS eligible`,
    [observation.id, observation.submittedAt],
  );
  if (!eligible[0]?.eligible) {
    await updateReminderStatus(observation, reminderPeriod, "skipped");
    return "skipped";
  }

  const emailResult = await sendReminder(
    observation.staffId,
    observation.staffEmail,
    observation.staffName ?? observation.staffEmail,
    observation.managerName ?? observation.managerEmail ?? "Observer",
    observation.observationTitle,
    observation.id,
  );
  await updateReminderStatus(
    observation,
    reminderPeriod,
    emailResult.success ? "sent" : "failed",
    emailResult.success ? null : emailResult.error ?? "Email delivery failed",
  );
  return emailResult.success ? "sent" : "failed";
}

async function updateReminderStatus(
  observation: PendingObservationRow,
  reminderPeriod: number,
  status: "sent" | "skipped" | "failed",
  error: string | null = null,
): Promise<void> {
  await query(
    `UPDATE observation_acknowledgement_reminders
     SET status = $4,
         error = $5,
         sent_at = CASE WHEN $4 = 'sent' THEN NOW() ELSE NULL END
     WHERE observation_id = $1
       AND submission_at = $2
       AND reminder_period = $3`,
    [
      observation.id,
      observation.submittedAt,
      reminderPeriod,
      status,
      error,
    ],
  );
}

async function automaticallyAcknowledgeObservation(
  observation: PendingObservationRow,
  now: Date,
  sendAutomaticAcknowledgement: typeof notifyObservationAutomaticallyAcknowledged,
): Promise<boolean> {
  const client = await pool.connect();
  let acknowledged = false;
  try {
    await client.query("BEGIN");
    const update = await client.query<{ id: string }>(
      `UPDATE observations
       SET status = 'acknowledged',
           acknowledged_at = $2,
           acknowledgement_method = 'automatic',
           acknowledgement_note = $3,
           updated_at = NOW()
       WHERE id = $1
         AND status = 'submitted'
         AND acknowledged_at IS NULL
         AND submitted_at = $4
         AND acknowledgement_automation_started_at IS NOT NULL
       RETURNING id`,
      [
        observation.id,
        now,
        AUTOMATIC_ACKNOWLEDGEMENT_NOTE,
        observation.submittedAt,
      ],
    );
    if (!update.rows[0]) {
      await client.query("ROLLBACK");
      return false;
    }

    await client.query(
      `INSERT INTO observation_updates
         (id, observation_id, updated_by_id, status_from, status_to, event_type, notes, created_at)
       VALUES ($1, $2, NULL, 'submitted', 'acknowledged', 'automatic_acknowledged', $3, $4)`,
      [randomUUID(), observation.id, AUTOMATIC_ACKNOWLEDGEMENT_NOTE, now],
    );
    await client.query("COMMIT");
    acknowledged = true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  if (!acknowledged) return false;

  const staffName = observation.staffName ?? observation.staffEmail;
  const managerName =
    observation.managerName ?? observation.managerEmail ?? "Observer";
  const notifications = [
    sendAutomaticAcknowledgement(
      observation.staffId,
      observation.staffEmail,
      staffName,
      staffName,
      managerName,
      observation.observationTitle,
      observation.id,
    ),
  ];
  if (observation.managerId && observation.managerEmail) {
    notifications.push(
      sendAutomaticAcknowledgement(
        observation.managerId,
        observation.managerEmail,
        managerName,
        staffName,
        managerName,
        observation.observationTitle,
        observation.id,
      ),
    );
  }
  const settled = await Promise.allSettled(notifications);
  for (const notification of settled) {
    if (notification.status === "rejected") {
      console.error(
        `[Observation automation] Automatic acknowledgement notification failed for ${observation.id}:`,
        notification.reason,
      );
    } else if (!notification.value.success) {
      console.error(
        `[Observation automation] Automatic acknowledgement email failed for ${observation.id}:`,
        notification.value.error,
      );
    }
  }

  return true;
}
