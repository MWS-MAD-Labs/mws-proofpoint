-- Migration: 20260520000000_milestone4_manager_observation_runtime
-- Milestone 4: Manager creates observation, staff only acknowledges.
-- Changes:
--   1. Add workflow_definition_id to observations table (links to which workflow was used)
--   2. Add work_definition_id index
--   3. Rename submitted status flow: draft → submitted → acknowledged
--      (remove "pending" which was ambiguous; manager submits → staff acknowledges)

-- 1. Add workflow_definition_id to observations (nullable for backward compat)
ALTER TABLE observations
  ADD COLUMN IF NOT EXISTS workflow_definition_id TEXT
    REFERENCES workflow_definitions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "observations_workflow_definition_id_idx"
  ON observations(workflow_definition_id);

-- 2. The status flow for manager-created observations:
--    draft      → manager is filling the form
--    submitted  → manager submitted; staff notified, waiting to acknowledge
--    acknowledged → staff confirmed they received the result
--
-- No schema change needed for ObservationStatus enum (draft/submitted/reviewed/acknowledged
-- already exist). We just enforce that "submitted" is set by manager, "acknowledged" by staff.

-- 3. Ensure observations table has createdById so we can track who created (the manager).
ALTER TABLE observations
  ADD COLUMN IF NOT EXISTS created_by_id UUID
    REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "observations_created_by_id_idx"
  ON observations(created_by_id);

-- 4. Drop "pending" status from any old rows that used it (normalize to submitted)
UPDATE observations SET status = 'submitted' WHERE status = 'pending';
