import { randomUUID } from "node:crypto";
import { pool, query } from "@/lib/db";

import {
  notifyObservationAcknowledgementReminder,
  notifyObservationAutomaticallyAcknowledged,
} from "@/lib/notifications/observation-notifications";
import {
  getObservationReminderPeriod,
  isAutomaticAcknowledgementDue,
} from "./acknowledgementAutomationConfig";
import {
  getObservationNotificationSettings,
  type ObservationNotificationSettings,
} from "./notificationSettings";

const AUTOMATIC_ACKNOWLEDGEMENT_NOTE =
  "Automatically acknowledged because the participant response deadline passed.";

interface PendingParticipantRow {
  id: string;
  participantId: string;
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

export interface ObservationAutomationOptions {
  observationIds?: string[];
  settings?: ObservationNotificationSettings;
  readSettings?: typeof getObservationNotificationSettings;
  sendReminder?: typeof notifyObservationAcknowledgementReminder;
  sendAutomaticAcknowledgement?: typeof notifyObservationAutomaticallyAcknowledged;
  afterReminderClaim?: (
    observationId: string,
    submissionAt: Date,
    reminderPeriod: number,
    participantId?: string,
  ) => Promise<void>;
  beforeAutomaticAcknowledgement?: (
    observationId: string,
    submissionAt: Date,
    participantId?: string,
  ) => Promise<void>;
}

export async function processObservationAcknowledgementAutomation(
  now = new Date(),
  options: ObservationAutomationOptions = {},
): Promise<ObservationAutomationResult> {
  const settings =
    options.settings ??
    (await (options.readSettings ?? getObservationNotificationSettings)());
  const observationIds = options.observationIds?.length
    ? options.observationIds
    : null;
  const participants = await query<PendingParticipantRow>(
    `SELECT
       o.id,
       op.id AS "participantId",
       op.staff_id AS "staffId",
       o."managerId" AS "managerId",
       su.email AS "staffEmail",
       sp.full_name AS "staffName",
       mu.email AS "managerEmail",
       mp.full_name AS "managerName",
       COALESCE(NULLIF(BTRIM(o.title), ''), rt.name, 'Observation') AS "observationTitle",
       o.submitted_at AS "submittedAt",
       op.acknowledgement_automation_started_at AS "automationStartedAt"
     FROM observation_participants op
     JOIN observations o ON o.id = op.observation_id
     JOIN users su ON su.id = op.staff_id
     LEFT JOIN profiles sp ON sp.user_id = su.id
     LEFT JOIN users mu ON mu.id = o."managerId"
     LEFT JOIN profiles mp ON mp.user_id = mu.id
     LEFT JOIN rubric_templates rt ON rt.id = o.template_id
     WHERE o.status = 'submitted'
       AND op.acknowledged_at IS NULL
       AND o.submitted_at IS NOT NULL
       AND op.acknowledgement_automation_started_at IS NOT NULL
       AND ($1::uuid[] IS NULL OR o.id = ANY($1::uuid[]))
     ORDER BY op.acknowledgement_automation_started_at ASC, op.id ASC
     LIMIT 500`,
    [observationIds],
  );

  const result: ObservationAutomationResult = {
    checked: participants.length,
    remindersSent: 0,
    remindersSkipped: 0,
    automaticallyAcknowledged: 0,
    automaticAcknowledgementsSkipped: 0,
    errors: 0,
  };

  for (const participant of participants) {
    try {
      if (
        settings.notificationsEnabled &&
        settings.automaticAcknowledgementEnabled &&
        isAutomaticAcknowledgementDue(
          participant.automationStartedAt,
          now,
          settings,
        )
      ) {
        await options.beforeAutomaticAcknowledgement?.(
          participant.id,
          participant.submittedAt,
          participant.participantId,
        );
        const acknowledged = await automaticallyAcknowledgeParticipant(
          participant,
          now,
          options.sendAutomaticAcknowledgement ??
            notifyObservationAutomaticallyAcknowledged,
          settings,
        );
        if (acknowledged) result.automaticallyAcknowledged += 1;
        else result.automaticAcknowledgementsSkipped += 1;
        continue;
      }

      if (!settings.notificationsEnabled || !settings.reminderEmailsEnabled) {
        continue;
      }

      const reminderPeriod = getObservationReminderPeriod(
        participant.automationStartedAt,
        now,
        settings,
      );
      if (reminderPeriod === null) continue;

      const claimed = await claimReminder(participant, reminderPeriod);
      if (!claimed) {
        result.remindersSkipped += 1;
        continue;
      }

      await options.afterReminderClaim?.(
        participant.id,
        participant.submittedAt,
        reminderPeriod,
        participant.participantId,
      );

      const reminderStatus = await sendClaimedReminder(
        participant,
        reminderPeriod,
        options.sendReminder ?? notifyObservationAcknowledgementReminder,
        settings,
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
        `[Observation automation] Failed for participant ${participant.participantId} on observation ${participant.id}:`,
        error,
      );
    }
  }

  return result;
}

async function claimReminder(
  participant: PendingParticipantRow,
  reminderPeriod: number,
): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `INSERT INTO observation_acknowledgement_reminders
       (id, participant_id, submission_at, reminder_period, status, created_at)
     VALUES ($1, $2, $3, $4, 'processing', NOW())
     ON CONFLICT (participant_id, submission_at, reminder_period) DO UPDATE
       SET status = 'processing', error = NULL, sent_at = NULL, created_at = NOW()
       WHERE observation_acknowledgement_reminders.status = 'failed'
          OR (
            observation_acknowledgement_reminders.status = 'processing'
            AND observation_acknowledgement_reminders.created_at < NOW() - INTERVAL '1 hour'
          )
     RETURNING id`,
    [
      randomUUID(),
      participant.participantId,
      participant.submittedAt,
      reminderPeriod,
    ],
  );
  return Boolean(rows[0]);
}

async function sendClaimedReminder(
  participant: PendingParticipantRow,
  reminderPeriod: number,
  sendReminder: typeof notifyObservationAcknowledgementReminder,
  settings: ObservationNotificationSettings,
): Promise<"sent" | "skipped" | "failed"> {
  const eligible = await query<{ eligible: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM observation_participants op
       JOIN observations o ON o.id = op.observation_id
       WHERE op.id = $1
         AND o.id = $2
         AND o.status = 'submitted'
         AND op.acknowledged_at IS NULL
         AND o.submitted_at = $3
         AND op.acknowledgement_automation_started_at = $4
     ) AS eligible`,
    [
      participant.participantId,
      participant.id,
      participant.submittedAt,
      participant.automationStartedAt,
    ],
  );
  if (!eligible[0]?.eligible) {
    await updateReminderStatus(participant, reminderPeriod, "skipped");
    return "skipped";
  }

  const emailResult = await sendReminder(
    participant.staffId,
    participant.staffEmail,
    participant.staffName ?? participant.staffEmail,
    participant.managerName ?? participant.managerEmail ?? "Observer",
    participant.observationTitle,
    participant.id,
    settings,
  );
  await updateReminderStatus(
    participant,
    reminderPeriod,
    emailResult.success ? "sent" : "failed",
    emailResult.success ? null : emailResult.error ?? "Email delivery failed",
  );
  return emailResult.success ? "sent" : "failed";
}

async function updateReminderStatus(
  participant: PendingParticipantRow,
  reminderPeriod: number,
  status: "sent" | "skipped" | "failed",
  error: string | null = null,
): Promise<void> {
  await query(
    `UPDATE observation_acknowledgement_reminders
     SET status = $4,
         error = $5,
         sent_at = CASE WHEN $4 = 'sent' THEN NOW() ELSE NULL END
     WHERE participant_id = $1
       AND submission_at = $2
       AND reminder_period = $3`,
    [
      participant.participantId,
      participant.submittedAt,
      reminderPeriod,
      status,
      error,
    ],
  );
}

async function automaticallyAcknowledgeParticipant(
  participant: PendingParticipantRow,
  now: Date,
  sendAutomaticAcknowledgement: typeof notifyObservationAutomaticallyAcknowledged,
  settings: ObservationNotificationSettings,
): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const parentResult = await client.query<{ status: string; submittedAt: Date }>(
      `SELECT status, submitted_at AS "submittedAt"
       FROM observations
       WHERE id = $1
       FOR UPDATE`,
      [participant.id],
    );
    const parent = parentResult.rows[0];
    if (
      !parent ||
      parent.status !== "submitted" ||
      parent.submittedAt.getTime() !== participant.submittedAt.getTime()
    ) {
      await client.query("ROLLBACK");
      return false;
    }

    const update = await client.query<{ staffId: string }>(
      `UPDATE observation_participants
       SET acknowledged_at = $3,
           acknowledgement_method = 'automatic',
           acknowledgement_response = NULL,
           acknowledgement_note = $4,
           updated_at = NOW()
       WHERE id = $1
         AND observation_id = $2
         AND acknowledged_at IS NULL
         AND acknowledgement_automation_started_at = $5
       RETURNING staff_id AS "staffId"`,
      [
        participant.participantId,
        participant.id,
        now,
        AUTOMATIC_ACKNOWLEDGEMENT_NOTE,
        participant.automationStartedAt,
      ],
    );
    const updatedParticipant = update.rows[0];
    if (!updatedParticipant) {
      await client.query("ROLLBACK");
      return false;
    }

    const pendingResult = await client.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM observation_participants
       WHERE observation_id = $1 AND acknowledged_at IS NULL`,
      [participant.id],
    );
    const completed = (pendingResult.rows[0]?.count ?? 0) === 0;

    if (completed) {
      await client.query(
        `UPDATE observations
         SET status = 'acknowledged',
             acknowledged_at = $2,
             acknowledgement_method = (
               SELECT CASE
                 WHEN BOOL_AND(op.acknowledgement_method = 'automatic')
                   THEN 'automatic'
                 ELSE 'personal'
               END
               FROM observation_participants op
               WHERE op.observation_id = observations.id
             ),
             acknowledgement_response = NULL,
             acknowledgement_note = NULL,
             updated_at = NOW()
         WHERE id = $1`,
        [participant.id, now],
      );
    }

    await client.query(
      `INSERT INTO observation_updates
         (id, observation_id, updated_by_id, staff_id, status_from, status_to,
          event_type, notes, created_at)
       VALUES ($1, $2, NULL, $3, 'submitted', $4,
               'participant_auto_acknowledged', $5, $6)`,
      [
        randomUUID(),
        participant.id,
        updatedParticipant.staffId,
        completed ? "acknowledged" : "submitted",
        AUTOMATIC_ACKNOWLEDGEMENT_NOTE,
        now,
      ],
    );

    if (completed) {
      await client.query(
        `INSERT INTO observation_updates
           (id, observation_id, updated_by_id, status_from, status_to,
            event_type, notes, created_at)
         VALUES ($1, $2, NULL, 'submitted', 'acknowledged',
                 'all_participants_acknowledged', $3, $4)`,
        [
          randomUUID(),
          participant.id,
          "All observation participants have acknowledged.",
          now,
        ],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  const staffName = participant.staffName ?? participant.staffEmail;
  const managerName =
    participant.managerName ?? participant.managerEmail ?? "Observer";
  const notification = await Promise.allSettled([
    sendAutomaticAcknowledgement(
      participant.staffId,
      participant.staffEmail,
      staffName,
      staffName,
      managerName,
      participant.observationTitle,
      participant.id,
      settings,
    ),
  ]);
  for (const delivery of notification) {
    if (delivery.status === "rejected") {
      console.error(
        `[Observation automation] Automatic acknowledgement notification failed for participant ${participant.participantId}:`,
        delivery.reason,
      );
    } else if (!delivery.value.success) {
      console.error(
        `[Observation automation] Automatic acknowledgement email failed for participant ${participant.participantId}:`,
        delivery.value.error,
      );
    }
  }

  return true;
}
