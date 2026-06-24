-- Migration: 20260622000000_milestone6_data_migration
-- Milestone 6: Existing Data Migration from NLSmartrack
--
-- Changes:
--   1. Add nlsmartrack_id column on users for deduplication
--   2. Add nlsmartrack_id column on observations for deduplication
--   3. Add nlsmartrack_id column on assessments for deduplication
--   4. Add migration_source column on profiles
--   5. Create migration_log table to track import history

-- 1. Add nlsmartrack_id to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS nlsmartrack_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "users_nlsmartrack_id_idx"
  ON users(nlsmartrack_id)
  WHERE nlsmartrack_id IS NOT NULL;

-- 2. Add migration_source to profiles table
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS migration_source TEXT DEFAULT NULL;

-- 3. Add nlsmartrack_id to observations table for deduplication
ALTER TABLE observations
  ADD COLUMN IF NOT EXISTS nlsmartrack_id TEXT DEFAULT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "observations_nlsmartrack_id_idx"
  ON observations(nlsmartrack_id)
  WHERE nlsmartrack_id IS NOT NULL;

-- 4. Add nlsmartrack_id to assessments table for deduplication
ALTER TABLE assessments
  ADD COLUMN IF NOT EXISTS nlsmartrack_id TEXT DEFAULT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "assessments_nlsmartrack_id_idx"
  ON assessments(nlsmartrack_id)
  WHERE nlsmartrack_id IS NOT NULL;

-- 5. Create migration_log table to track import history
CREATE TABLE IF NOT EXISTS migration_log (
  id          SERIAL PRIMARY KEY,
  entity_type TEXT        NOT NULL,
  source_id   TEXT        NOT NULL,
  target_id   TEXT        NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'success',
  notes       TEXT,
  migrated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "migration_log_entity_type_idx"
  ON migration_log(entity_type);

CREATE INDEX IF NOT EXISTS "migration_log_status_idx"
  ON migration_log(status);
