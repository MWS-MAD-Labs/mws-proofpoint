-- Migration: 20260609000000_milestone5_staff_acknowledgement
-- Milestone 5: Staff Acknowledgement
--
-- Changes:
--   1. observation_updates table — ensure updated_by_id is UUID type (not TEXT)
--      so it properly references users.id
--   2. Add index on observation_updates.observation_id for performance
--   3. Normalize any leftover 'pending' status rows to 'submitted'
--      (migration 20260520 already did this but safety net)

-- 1. Ensure observation_updates.updated_by_id references users correctly
--    (Add FK if not already present — safe to run multiple times)
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