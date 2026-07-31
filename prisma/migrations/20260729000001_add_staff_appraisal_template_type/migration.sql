-- Dedicated rubric mode for manager-led staff performance appraisals.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = current_schema() AND t.typname = 'TemplateType'
  ) THEN
    ALTER TYPE "TemplateType" ADD VALUE IF NOT EXISTS 'STAFF_APPRAISAL';
  END IF;
END $$;

ALTER TABLE kpis
  ADD COLUMN IF NOT EXISTS performance_weight DECIMAL(5, 2) NOT NULL DEFAULT 100;
