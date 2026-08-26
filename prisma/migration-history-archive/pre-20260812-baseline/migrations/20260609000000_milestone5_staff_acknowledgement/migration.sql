-- Migration: 20260609000000_milestone5_staff_acknowledgement
-- Milestone 5: Staff Acknowledgement
--
-- Changes:
--   1. Ensure observation_updates.updated_by_id has its user FK.
--   2. Add indexes used by acknowledgement audit/status lookups.
--   3. Normalize any leftover 'pending' status rows to 'submitted'
--      (migration 20260520 already did this but safety net).
--
-- Note: the canonical observation_updates columns are updated_by_id,
-- status_from, and status_to. No camelCase columns are introduced here.

-- 1. Ensure observation_updates.updated_by_id references users correctly
--    (add FK if not already present — safe to run multiple times)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'observation_updates_updated_by_id_fkey'
      AND table_name = 'observation_updates'
  ) THEN
    ALTER TABLE observation_updates
      ADD CONSTRAINT observation_updates_updated_by_id_fkey
      FOREIGN KEY (updated_by_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2. Performance index for audit trail queries
CREATE INDEX IF NOT EXISTS "observation_updates_observation_id_idx"
  ON observation_updates(observation_id);

CREATE INDEX IF NOT EXISTS "observation_updates_created_at_idx"
  ON observation_updates(created_at);

-- 3. Safety: normalize any leftover 'pending' → 'submitted'
UPDATE observations SET status = 'submitted' WHERE status = 'pending';
