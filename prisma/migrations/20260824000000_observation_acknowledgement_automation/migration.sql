-- Observation acknowledgement reminders and automatic acknowledgement.
-- Existing observations are deliberately left ineligible until they are submitted again.

ALTER TABLE observations
  ADD COLUMN IF NOT EXISTS acknowledgement_method TEXT,
  ADD COLUMN IF NOT EXISTS acknowledgement_note TEXT,
  ADD COLUMN IF NOT EXISTS acknowledgement_automation_started_at TIMESTAMP(3);

ALTER TABLE observations
  DROP CONSTRAINT IF EXISTS observations_acknowledgement_method_check;

ALTER TABLE observations
  ADD CONSTRAINT observations_acknowledgement_method_check
  CHECK (acknowledgement_method IS NULL OR acknowledgement_method IN ('personal', 'automatic'));

-- Mark existing completed observations as personal without changing their dates or responses.
UPDATE observations
SET acknowledgement_method = 'personal'
WHERE acknowledged_at IS NOT NULL
  AND acknowledgement_method IS NULL;

CREATE INDEX IF NOT EXISTS observations_acknowledgement_automation_idx
  ON observations(status, acknowledgement_automation_started_at)
  WHERE status = 'submitted' AND acknowledged_at IS NULL;

CREATE TABLE IF NOT EXISTS observation_acknowledgement_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  observation_id UUID NOT NULL REFERENCES observations(id) ON DELETE CASCADE,
  submission_at TIMESTAMP(3) NOT NULL,
  reminder_period INTEGER NOT NULL CHECK (reminder_period >= 0),
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'sent', 'skipped', 'failed')),
  error TEXT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP(3),
  UNIQUE (observation_id, submission_at, reminder_period)
);

CREATE INDEX IF NOT EXISTS observation_acknowledgement_reminders_observation_idx
  ON observation_acknowledgement_reminders(observation_id);

CREATE INDEX IF NOT EXISTS observation_acknowledgement_reminders_status_idx
  ON observation_acknowledgement_reminders(status);

ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS observation_updates BOOLEAN NOT NULL DEFAULT true;
