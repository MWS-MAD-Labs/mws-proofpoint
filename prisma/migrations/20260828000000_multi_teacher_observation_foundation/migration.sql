-- Multi-teacher observation database foundation (Phase A).
-- This migration is forward-only and deliberately retains all legacy observation columns,
-- relations, and the reminder observation_id compatibility path.

BEGIN;

ALTER TABLE observations
  ADD COLUMN scope_type TEXT NOT NULL DEFAULT 'INDIVIDUAL',
  ADD COLUMN class_name TEXT,
  ADD COLUMN subject_name TEXT;

ALTER TABLE observations
  ADD CONSTRAINT observations_scope_type_check
    CHECK (scope_type IN ('INDIVIDUAL', 'CLASS', 'SUBJECT')),
  ADD CONSTRAINT observations_scope_context_check
    CHECK (
      (scope_type <> 'CLASS' OR NULLIF(BTRIM(class_name), '') IS NOT NULL)
      AND (scope_type <> 'SUBJECT' OR NULLIF(BTRIM(subject_name), '') IS NOT NULL)
    );

CREATE TABLE observation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  observation_id UUID NOT NULL,
  staff_id UUID NOT NULL,
  acknowledged_at TIMESTAMP(3),
  acknowledgement_method TEXT,
  acknowledgement_response TEXT,
  acknowledgement_note TEXT,
  acknowledgement_automation_started_at TIMESTAMP(3),
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT observation_participants_observation_id_fkey
    FOREIGN KEY (observation_id) REFERENCES observations(id)
    ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT observation_participants_staff_id_fkey
    FOREIGN KEY (staff_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE NO ACTION,
  CONSTRAINT observation_participants_observation_id_staff_id_key
    UNIQUE (observation_id, staff_id),
  CONSTRAINT observation_participants_acknowledgement_method_check
    CHECK (acknowledgement_method IS NULL OR acknowledgement_method IN ('personal', 'automatic')),
  CONSTRAINT observation_participants_acknowledgement_state_check
    CHECK (acknowledged_at IS NOT NULL OR acknowledgement_method IS NULL)
);

CREATE INDEX observation_participants_staff_id_observation_id_idx
  ON observation_participants(staff_id, observation_id);

CREATE INDEX observation_participants_observation_id_acknowledged_at_idx
  ON observation_participants(observation_id, acknowledged_at);

-- Fail explicitly instead of allowing the participant backfill to skip an observation.
DO $$
DECLARE
  unresolved_count BIGINT;
  unresolved_ids TEXT;
BEGIN
  SELECT COUNT(*), STRING_AGG(o.id::text, ', ' ORDER BY o.id::text)
  INTO unresolved_count, unresolved_ids
  FROM observations o
  LEFT JOIN users u ON u.id = o."staffId"
  WHERE o."staffId" IS NULL OR u.id IS NULL;

  IF unresolved_count > 0 THEN
    RAISE EXCEPTION
      'Cannot backfill observation participants: % observation(s) have an unresolved legacy staffId. Observation IDs: %',
      unresolved_count,
      unresolved_ids;
  END IF;
END
$$;

INSERT INTO observation_participants (
  observation_id,
  staff_id,
  acknowledged_at,
  acknowledgement_method,
  acknowledgement_response,
  acknowledgement_note,
  acknowledgement_automation_started_at,
  created_at,
  updated_at
)
SELECT
  o.id,
  o."staffId",
  o.acknowledged_at,
  o.acknowledgement_method,
  o.acknowledgement_response,
  o.acknowledgement_note,
  o.acknowledgement_automation_started_at,
  o.created_at,
  o.updated_at
FROM observations o;

-- Move reminder ownership to the participant while retaining observation_id temporarily
-- for unchanged Phase A application SQL and legacy reporting queries.
ALTER TABLE observation_acknowledgement_reminders
  ADD COLUMN participant_id UUID;

UPDATE observation_acknowledgement_reminders reminder
SET participant_id = participant.id
FROM observation_participants participant
WHERE participant.observation_id = reminder.observation_id
  AND participant.staff_id = (
    SELECT observation."staffId"
    FROM observations observation
    WHERE observation.id = reminder.observation_id
  );

DO $$
DECLARE
  unresolved_count BIGINT;
  unresolved_ids TEXT;
BEGIN
  SELECT COUNT(*), STRING_AGG(reminder.id::text, ', ' ORDER BY reminder.id::text)
  INTO unresolved_count, unresolved_ids
  FROM observation_acknowledgement_reminders reminder
  WHERE reminder.participant_id IS NULL;

  IF unresolved_count > 0 THEN
    RAISE EXCEPTION
      'Cannot migrate acknowledgement reminders: % reminder(s) have no backfilled participant. Reminder IDs: %',
      unresolved_count,
      unresolved_ids;
  END IF;
END
$$;

ALTER TABLE observation_acknowledgement_reminders
  ALTER COLUMN participant_id SET NOT NULL,
  ALTER COLUMN observation_id DROP NOT NULL,
  ADD CONSTRAINT observation_acknowledgement_reminders_participant_id_fkey
    FOREIGN KEY (participant_id) REFERENCES observation_participants(id)
    ON DELETE CASCADE ON UPDATE NO ACTION,
  ADD CONSTRAINT observation_ack_reminders_participant_submission_period_key
    UNIQUE (participant_id, submission_at, reminder_period);

CREATE INDEX observation_acknowledgement_reminders_participant_idx
  ON observation_acknowledgement_reminders(participant_id);

-- During the compatibility release, accept either reminder ownership shape:
-- legacy callers provide observation_id and the single participant is resolved;
-- participant-native callers provide participant_id and may leave observation_id null so
-- the legacy observation-level unique key cannot collapse reminders for different teachers.
CREATE FUNCTION set_observation_acknowledgement_reminder_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  resolved_participant_id UUID;
  resolved_observation_id UUID;
  participant_count INTEGER;
BEGIN
  IF NEW.participant_id IS NULL AND NEW.observation_id IS NULL THEN
    RAISE EXCEPTION 'Acknowledgement reminder requires participant_id or observation_id';
  END IF;

  IF NEW.participant_id IS NULL THEN
    SELECT COUNT(*)
    INTO participant_count
    FROM observation_participants participant
    WHERE participant.observation_id = NEW.observation_id;

    IF participant_count <> 1 THEN
      RAISE EXCEPTION
        'Legacy acknowledgement reminder insert requires exactly one participant for observation %, found %',
        NEW.observation_id,
        participant_count;
    END IF;

    SELECT participant.id
    INTO resolved_participant_id
    FROM observation_participants participant
    WHERE participant.observation_id = NEW.observation_id;

    NEW.participant_id := resolved_participant_id;
  END IF;

  SELECT participant.observation_id
  INTO resolved_observation_id
  FROM observation_participants participant
  WHERE participant.id = NEW.participant_id;

  IF resolved_observation_id IS NULL THEN
    RAISE EXCEPTION 'Acknowledgement reminder participant % does not exist', NEW.participant_id;
  END IF;

  IF NEW.observation_id IS NOT NULL AND NEW.observation_id <> resolved_observation_id THEN
    RAISE EXCEPTION
      'Acknowledgement reminder observation % does not match participant % observation %',
      NEW.observation_id,
      NEW.participant_id,
      resolved_observation_id;
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER observation_acknowledgement_reminder_owner_trigger
BEFORE INSERT OR UPDATE OF participant_id, observation_id
ON observation_acknowledgement_reminders
FOR EACH ROW
EXECUTE FUNCTION set_observation_acknowledgement_reminder_owner();

-- Structured participant target for acknowledgement-related audit entries.
ALTER TABLE observation_updates
  ADD COLUMN staff_id UUID,
  ADD CONSTRAINT observation_updates_staff_id_fkey
    FOREIGN KEY (staff_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE INDEX observation_updates_staff_id_idx
  ON observation_updates(staff_id);

-- Final Phase A verification. Any failure aborts the whole migration transaction.
DO $$
DECLARE
  missing_participant_count BIGINT;
  duplicate_pair_count BIGINT;
  mismatched_reminder_count BIGINT;
BEGIN
  SELECT COUNT(*)
  INTO missing_participant_count
  FROM observations observation
  WHERE NOT EXISTS (
    SELECT 1
    FROM observation_participants participant
    WHERE participant.observation_id = observation.id
  );

  SELECT COUNT(*)
  INTO duplicate_pair_count
  FROM (
    SELECT observation_id, staff_id
    FROM observation_participants
    GROUP BY observation_id, staff_id
    HAVING COUNT(*) > 1
  ) duplicates;

  SELECT COUNT(*)
  INTO mismatched_reminder_count
  FROM observation_acknowledgement_reminders reminder
  JOIN observation_participants participant ON participant.id = reminder.participant_id
  WHERE reminder.observation_id IS NOT NULL
    AND reminder.observation_id <> participant.observation_id;

  IF missing_participant_count > 0 THEN
    RAISE EXCEPTION
      'Multi-teacher foundation verification failed: % observation(s) have no participants',
      missing_participant_count;
  END IF;

  IF duplicate_pair_count > 0 THEN
    RAISE EXCEPTION
      'Multi-teacher foundation verification failed: % duplicate observation/staff participant pair(s)',
      duplicate_pair_count;
  END IF;

  IF mismatched_reminder_count > 0 THEN
    RAISE EXCEPTION
      'Multi-teacher foundation verification failed: % reminder ownership mismatch(es)',
      mismatched_reminder_count;
  END IF;
END
$$;

COMMIT;
