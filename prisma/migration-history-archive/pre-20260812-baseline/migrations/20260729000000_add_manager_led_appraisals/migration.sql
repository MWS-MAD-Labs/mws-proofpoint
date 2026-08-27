-- Manager-led appraisal lifecycle: manager draft -> director review -> staff acknowledgement.

-- Older ProofPoint databases store assessments.status as text; newer canonical
-- installations use the quoted AssessmentStatus enum. Add enum values only
-- when the enum exists. Text-backed databases already accept the new values.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = current_schema() AND t.typname = 'AssessmentStatus'
  ) THEN
    ALTER TYPE "AssessmentStatus" ADD VALUE IF NOT EXISTS 'pending_director_review';
    ALTER TYPE "AssessmentStatus" ADD VALUE IF NOT EXISTS 'director_reviewed';
  END IF;
END $$;

-- Workflow identifiers are UUID in older deployed databases and TEXT in the
-- canonical migration history. Match the referenced column type dynamically.
DO $$
DECLARE
  workflow_id_type TEXT;
  assignment_id_type TEXT;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod)
    INTO workflow_id_type
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = current_schema() AND c.relname = 'workflow_definitions'
     AND a.attname = 'id' AND a.attnum > 0 AND NOT a.attisdropped;

  SELECT format_type(a.atttypid, a.atttypmod)
    INTO assignment_id_type
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = current_schema() AND c.relname = 'role_workflow_assignments'
     AND a.attname = 'id' AND a.attnum > 0 AND NOT a.attisdropped;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'assessments' AND column_name = 'workflow_id') THEN
    EXECUTE format('ALTER TABLE assessments ADD COLUMN workflow_id %s', workflow_id_type);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'assessments' AND column_name = 'workflow_assignment_id') THEN
    EXECUTE format('ALTER TABLE assessments ADD COLUMN workflow_assignment_id %s', assignment_id_type);
  END IF;
END $$;

ALTER TABLE assessments
  ADD COLUMN IF NOT EXISTS workflow_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS current_step_order INTEGER,
  ADD COLUMN IF NOT EXISTS initiated_by_id UUID,
  ADD COLUMN IF NOT EXISTS manager_submitted_at TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS director_reviewed_at TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP(3);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assessments_workflow_id_fkey') THEN
    ALTER TABLE assessments ADD CONSTRAINT assessments_workflow_id_fkey
      FOREIGN KEY (workflow_id) REFERENCES workflow_definitions(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assessments_workflow_assignment_id_fkey') THEN
    ALTER TABLE assessments ADD CONSTRAINT assessments_workflow_assignment_id_fkey
      FOREIGN KEY (workflow_assignment_id) REFERENCES role_workflow_assignments(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assessments_initiated_by_id_fkey') THEN
    ALTER TABLE assessments ADD CONSTRAINT assessments_initiated_by_id_fkey
      FOREIGN KEY (initiated_by_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS assessments_workflow_id_idx ON assessments(workflow_id);
CREATE INDEX IF NOT EXISTS assessments_current_step_order_idx ON assessments(current_step_order);
CREATE INDEX IF NOT EXISTS assessments_initiated_by_id_idx ON assessments(initiated_by_id);

CREATE TABLE IF NOT EXISTS assessment_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  updated_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  step_order INTEGER,
  status_from TEXT,
  status_to TEXT NOT NULL,
  event_type TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS assessment_updates_assessment_id_idx ON assessment_updates(assessment_id);
CREATE INDEX IF NOT EXISTS assessment_updates_created_at_idx ON assessment_updates(created_at);
