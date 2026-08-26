import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { z } from "zod";
import { pool, query } from "@/lib/db";

export const DEFAULT_OBSERVATION_SCHEDULER_INTERVAL_MINUTES = 60;
const SETTINGS_ID = 1;

export const observationNotificationSettingsUpdateSchema = z
  .object({
    notificationsEnabled: z.boolean(),
    submissionEmailsEnabled: z.boolean(),
    reminderEmailsEnabled: z.boolean(),
    firstReminderDays: z.number().int().min(1).max(90),
    reminderIntervalDays: z.number().int().min(1).max(90),
    automaticAcknowledgementEnabled: z.boolean(),
    automaticAcknowledgementDays: z.number().int().min(1).max(365),
    personalAcknowledgementEmailsEnabled: z.boolean(),
    automaticAcknowledgementEmailsEnabled: z.boolean(),
    reopenEmailsEnabled: z.boolean(),
    reassignmentEmailsEnabled: z.boolean(),
    schedulerEnabled: z.boolean(),
    schedulerIntervalMinutes: z.number().int().min(5).max(1440),
  })
  .strict()
  .superRefine((settings, context) => {
    if (
      settings.reminderEmailsEnabled &&
      settings.automaticAcknowledgementDays <= settings.firstReminderDays
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["automaticAcknowledgementDays"],
        message:
          "Automatic acknowledgement days must be greater than the first reminder delay when reminders are enabled.",
      });
    }
  });

export type ObservationNotificationSettingsUpdate = z.infer<
  typeof observationNotificationSettingsUpdateSchema
>;

export interface ObservationNotificationSettingsActor {
  id: string;
  name: string | null;
  email: string;
}

export interface ObservationNotificationSettings
  extends ObservationNotificationSettingsUpdate {
  updatedAt: string;
  updatedBy: ObservationNotificationSettingsActor | null;
}

export type ObservationNotificationEvent =
  | "submission"
  | "reminder"
  | "personalAcknowledgement"
  | "automaticAcknowledgement"
  | "reopen"
  | "reassignment";

type EventSettingKey = Exclude<
  keyof ObservationNotificationSettingsUpdate,
  | "notificationsEnabled"
  | "firstReminderDays"
  | "reminderIntervalDays"
  | "automaticAcknowledgementEnabled"
  | "automaticAcknowledgementDays"
  | "schedulerEnabled"
  | "schedulerIntervalMinutes"
>;

export const OBSERVATION_NOTIFICATION_EVENT_POLICY = {
  submission: "submissionEmailsEnabled",
  reminder: "reminderEmailsEnabled",
  personalAcknowledgement: "personalAcknowledgementEmailsEnabled",
  automaticAcknowledgement: "automaticAcknowledgementEmailsEnabled",
  reopen: "reopenEmailsEnabled",
  reassignment: "reassignmentEmailsEnabled",
} as const satisfies Record<ObservationNotificationEvent, EventSettingKey>;

const DEFAULT_UPDATE_SETTINGS: ObservationNotificationSettingsUpdate = {
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
  schedulerIntervalMinutes: DEFAULT_OBSERVATION_SCHEDULER_INTERVAL_MINUTES,
};

export const DEFAULT_OBSERVATION_NOTIFICATION_SETTINGS: ObservationNotificationSettings = {
  ...DEFAULT_UPDATE_SETTINGS,
  updatedAt: new Date(0).toISOString(),
  updatedBy: null,
};

interface SettingsRow extends ObservationNotificationSettingsUpdate {
  updatedAt: Date | string;
  updatedById: string | null;
  updatedByName: string | null;
  updatedByEmail: string | null;
}

const SETTINGS_SELECT = `
  SELECT s.notifications_enabled AS "notificationsEnabled",
         s.submission_emails_enabled AS "submissionEmailsEnabled",
         s.reminder_emails_enabled AS "reminderEmailsEnabled",
         s.first_reminder_days AS "firstReminderDays",
         s.reminder_interval_days AS "reminderIntervalDays",
         s.automatic_acknowledgement_enabled AS "automaticAcknowledgementEnabled",
         s.automatic_acknowledgement_days AS "automaticAcknowledgementDays",
         s.personal_ack_email_enabled AS "personalAcknowledgementEmailsEnabled",
         s.automatic_ack_email_enabled AS "automaticAcknowledgementEmailsEnabled",
         s.reopen_emails_enabled AS "reopenEmailsEnabled",
         s.reassignment_emails_enabled AS "reassignmentEmailsEnabled",
         s.scheduler_enabled AS "schedulerEnabled",
         s.scheduler_interval_minutes AS "schedulerIntervalMinutes",
         s.updated_at AS "updatedAt",
         u.id::text AS "updatedById",
         p.full_name AS "updatedByName",
         u.email AS "updatedByEmail"
    FROM observation_notification_settings s
    LEFT JOIN users u ON u.id = s.updated_by_id
    LEFT JOIN profiles p ON p.user_id = u.id
   WHERE s.id = 1`;

function serializeSettings(row: SettingsRow): ObservationNotificationSettings {
  return {
    notificationsEnabled: row.notificationsEnabled,
    submissionEmailsEnabled: row.submissionEmailsEnabled,
    reminderEmailsEnabled: row.reminderEmailsEnabled,
    firstReminderDays: row.firstReminderDays,
    reminderIntervalDays: row.reminderIntervalDays,
    automaticAcknowledgementEnabled: row.automaticAcknowledgementEnabled,
    automaticAcknowledgementDays: row.automaticAcknowledgementDays,
    personalAcknowledgementEmailsEnabled:
      row.personalAcknowledgementEmailsEnabled,
    automaticAcknowledgementEmailsEnabled:
      row.automaticAcknowledgementEmailsEnabled,
    reopenEmailsEnabled: row.reopenEmailsEnabled,
    reassignmentEmailsEnabled: row.reassignmentEmailsEnabled,
    schedulerEnabled: row.schedulerEnabled,
    schedulerIntervalMinutes: row.schedulerIntervalMinutes,
    updatedAt: new Date(row.updatedAt).toISOString(),
    updatedBy:
      row.updatedById && row.updatedByEmail
        ? {
            id: row.updatedById,
            name: row.updatedByName,
            email: row.updatedByEmail,
          }
        : null,
  };
}

async function selectSettingsForUpdate(
  client: PoolClient,
): Promise<SettingsRow | null> {
  const result = await client.query<SettingsRow>(
    `${SETTINGS_SELECT} FOR UPDATE OF s`,
  );
  return result.rows[0] ?? null;
}

async function ensureSingletonRow(client: PoolClient): Promise<void> {
  await client.query(
    `INSERT INTO observation_notification_settings (id)
     VALUES ($1)
     ON CONFLICT (id) DO NOTHING`,
    [SETTINGS_ID],
  );
}

export async function getObservationNotificationSettings(): Promise<ObservationNotificationSettings> {
  const rows = await query<SettingsRow>(SETTINGS_SELECT);
  return rows[0]
    ? serializeSettings(rows[0])
    : { ...DEFAULT_OBSERVATION_NOTIFICATION_SETTINGS };
}

export async function updateObservationNotificationSettings(
  input: ObservationNotificationSettingsUpdate,
  actorId: string,
): Promise<ObservationNotificationSettings> {
  const settings = observationNotificationSettingsUpdateSchema.parse(input);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    let beforeRow = await selectSettingsForUpdate(client);
    if (!beforeRow) {
      await ensureSingletonRow(client);
      beforeRow = await selectSettingsForUpdate(client);
    }
    if (!beforeRow) {
      throw new Error("Unable to initialize observation notification settings.");
    }

    const beforeSettings = serializeSettings(beforeRow);
    await client.query(
      `UPDATE observation_notification_settings
          SET notifications_enabled = $1,
              submission_emails_enabled = $2,
              reminder_emails_enabled = $3,
              first_reminder_days = $4,
              reminder_interval_days = $5,
              automatic_acknowledgement_enabled = $6,
              automatic_acknowledgement_days = $7,
              personal_ack_email_enabled = $8,
              automatic_ack_email_enabled = $9,
              reopen_emails_enabled = $10,
              reassignment_emails_enabled = $11,
              scheduler_enabled = $12,
              scheduler_interval_minutes = $13,
              updated_by_id = $14,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $15`,
      [
        settings.notificationsEnabled,
        settings.submissionEmailsEnabled,
        settings.reminderEmailsEnabled,
        settings.firstReminderDays,
        settings.reminderIntervalDays,
        settings.automaticAcknowledgementEnabled,
        settings.automaticAcknowledgementDays,
        settings.personalAcknowledgementEmailsEnabled,
        settings.automaticAcknowledgementEmailsEnabled,
        settings.reopenEmailsEnabled,
        settings.reassignmentEmailsEnabled,
        settings.schedulerEnabled,
        settings.schedulerIntervalMinutes,
        actorId,
        SETTINGS_ID,
      ],
    );

    const afterRow = await selectSettingsForUpdate(client);
    if (!afterRow) {
      throw new Error("Observation notification settings disappeared during update.");
    }
    const afterSettings = serializeSettings(afterRow);

    await client.query(
      `INSERT INTO observation_notification_setting_updates
         (id, settings_id, actor_id, before_settings, after_settings)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)`,
      [
        randomUUID(),
        SETTINGS_ID,
        actorId,
        JSON.stringify(beforeSettings),
        JSON.stringify(afterSettings),
      ],
    );

    await client.query("COMMIT");
    return afterSettings;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export function isObservationNotificationEventEnabled(
  settings: Pick<
    ObservationNotificationSettings,
    "notificationsEnabled" | EventSettingKey
  >,
  event: ObservationNotificationEvent,
): boolean {
  return (
    settings.notificationsEnabled &&
    settings[OBSERVATION_NOTIFICATION_EVENT_POLICY[event]]
  );
}

export function getObservationSchedulerIntervalMs(
  settings?: Pick<ObservationNotificationSettings, "schedulerIntervalMinutes"> | null,
): number {
  const intervalMinutes = settings?.schedulerIntervalMinutes;
  const safeIntervalMinutes =
    Number.isInteger(intervalMinutes) &&
    intervalMinutes !== undefined &&
    intervalMinutes >= 5 &&
    intervalMinutes <= 1440
      ? intervalMinutes
      : DEFAULT_OBSERVATION_SCHEDULER_INTERVAL_MINUTES;

  return safeIntervalMinutes * 60 * 1000;
}
