-- Global observation notification policy and administrator audit history.

CREATE TABLE observation_notification_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  submission_emails_enabled BOOLEAN NOT NULL DEFAULT true,
  reminder_emails_enabled BOOLEAN NOT NULL DEFAULT true,
  first_reminder_days INTEGER NOT NULL DEFAULT 3,
  reminder_interval_days INTEGER NOT NULL DEFAULT 2,
  automatic_acknowledgement_enabled BOOLEAN NOT NULL DEFAULT true,
  automatic_acknowledgement_days INTEGER NOT NULL DEFAULT 30,
  personal_ack_email_enabled BOOLEAN NOT NULL DEFAULT true,
  automatic_ack_email_enabled BOOLEAN NOT NULL DEFAULT true,
  reopen_emails_enabled BOOLEAN NOT NULL DEFAULT true,
  reassignment_emails_enabled BOOLEAN NOT NULL DEFAULT true,
  scheduler_enabled BOOLEAN NOT NULL DEFAULT true,
  scheduler_interval_minutes INTEGER NOT NULL DEFAULT 60,
  updated_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT observation_notification_settings_singleton_check CHECK (id = 1),
  CONSTRAINT observation_notification_settings_first_reminder_days_check
    CHECK (first_reminder_days BETWEEN 1 AND 90),
  CONSTRAINT observation_notification_settings_reminder_interval_days_check
    CHECK (reminder_interval_days BETWEEN 1 AND 90),
  CONSTRAINT observation_notification_settings_automatic_acknowledgement_days_check
    CHECK (automatic_acknowledgement_days BETWEEN 1 AND 365),
  CONSTRAINT observation_notification_settings_scheduler_interval_minutes_check
    CHECK (scheduler_interval_minutes BETWEEN 5 AND 1440),
  CONSTRAINT observation_notification_settings_reminder_deadline_check
    CHECK (
      NOT reminder_emails_enabled
      OR automatic_acknowledgement_days > first_reminder_days
    )
);

CREATE INDEX observation_notification_settings_updated_by_idx
  ON observation_notification_settings(updated_by_id);

INSERT INTO observation_notification_settings (
  id,
  notifications_enabled,
  submission_emails_enabled,
  reminder_emails_enabled,
  first_reminder_days,
  reminder_interval_days,
  automatic_acknowledgement_enabled,
  automatic_acknowledgement_days,
  personal_ack_email_enabled,
  automatic_ack_email_enabled,
  reopen_emails_enabled,
  reassignment_emails_enabled,
  scheduler_enabled,
  scheduler_interval_minutes
)
VALUES (1, true, true, true, 3, 2, true, 30, true, true, true, true, true, 60);

CREATE TABLE observation_notification_setting_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settings_id INTEGER NOT NULL DEFAULT 1
    REFERENCES observation_notification_settings(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  before_settings JSONB NOT NULL,
  after_settings JSONB NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT observation_notification_setting_updates_settings_id_check
    CHECK (settings_id = 1)
);

CREATE INDEX observation_notification_setting_updates_settings_idx
  ON observation_notification_setting_updates(settings_id);

CREATE INDEX observation_notification_setting_updates_actor_idx
  ON observation_notification_setting_updates(actor_id);
