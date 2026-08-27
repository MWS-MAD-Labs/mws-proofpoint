-- Durable observation scheduler health and efficient notification-settings audit pagination.

CREATE TABLE observation_acknowledgement_scheduler_status (
  id INTEGER PRIMARY KEY DEFAULT 1,
  last_attempted_at TIMESTAMP(3),
  last_successful_at TIMESTAMP(3),
  settings_revision TIMESTAMP(3),
  next_expected_at TIMESTAMP(3),
  advisory_lock_skips INTEGER NOT NULL DEFAULT 0,
  checked INTEGER NOT NULL DEFAULT 0,
  reminded INTEGER NOT NULL DEFAULT 0,
  auto_acknowledged INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT observation_acknowledgement_scheduler_status_singleton_check CHECK (id = 1),
  CONSTRAINT observation_acknowledgement_scheduler_status_counts_check CHECK (
    advisory_lock_skips >= 0
    AND checked >= 0
    AND reminded >= 0
    AND auto_acknowledged >= 0
    AND skipped >= 0
    AND failed >= 0
  )
);

INSERT INTO observation_acknowledgement_scheduler_status (id) VALUES (1);

CREATE INDEX observation_notification_setting_updates_history_idx
  ON observation_notification_setting_updates(settings_id, created_at DESC, id DESC);
