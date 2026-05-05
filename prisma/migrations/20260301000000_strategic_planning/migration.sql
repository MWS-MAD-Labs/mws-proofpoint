CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
  CREATE TYPE "StrategicPlanStatus" AS ENUM ('draft', 'published');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ProgramStatus" AS ENUM ('not_started', 'on_track', 'at_risk', 'off_track', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- KPI codification prerequisite
ALTER TABLE "kpi_domains" ADD COLUMN IF NOT EXISTS "code" TEXT;
ALTER TABLE "kpi_domains" ADD COLUMN IF NOT EXISTS "legacy_code" TEXT;
ALTER TABLE "kpi_standards" ADD COLUMN IF NOT EXISTS "code" TEXT;
ALTER TABLE "kpi_standards" ADD COLUMN IF NOT EXISTS "legacy_code" TEXT;
ALTER TABLE "kpi_standards" ADD COLUMN IF NOT EXISTS "template_id" UUID;
ALTER TABLE "kpis" ADD COLUMN IF NOT EXISTS "code" TEXT;
ALTER TABLE "kpis" ADD COLUMN IF NOT EXISTS "legacy_code" TEXT;
ALTER TABLE "kpis" ADD COLUMN IF NOT EXISTS "template_id" UUID;

UPDATE "kpi_domains"
SET "legacy_code" = COALESCE("legacy_code", substring("name" from '^(D[0-9]+)'));

UPDATE "kpi_standards" s
SET "template_id" = d."template_id",
    "legacy_code" = COALESCE(s."legacy_code", substring(s."name" from '^(Standard [0-9]+|S[0-9]+)'))
FROM "kpi_domains" d
WHERE s."domain_id" = d."id";

UPDATE "kpis" k
SET "template_id" = s."template_id",
    "legacy_code" = COALESCE(k."legacy_code", substring(k."name" from '^(KPI [0-9]+(\.[0-9]+)?|K[0-9]+)'))
FROM "kpi_standards" s
WHERE k."standard_id" = s."id";

WITH numbered AS (
  SELECT id, 'D' || row_number() OVER (PARTITION BY template_id ORDER BY sort_order, created_at, id) AS new_code
  FROM kpi_domains
)
UPDATE kpi_domains d SET code = numbered.new_code FROM numbered WHERE d.id = numbered.id;

WITH numbered AS (
  SELECT s.id, 'S' || row_number() OVER (PARTITION BY d.template_id ORDER BY d.sort_order, d.created_at, d.id, s.sort_order, s.created_at, s.id) AS new_code
  FROM kpi_standards s
  JOIN kpi_domains d ON d.id = s.domain_id
)
UPDATE kpi_standards s SET code = numbered.new_code FROM numbered WHERE s.id = numbered.id;

WITH numbered AS (
  SELECT k.id, 'K' || row_number() OVER (PARTITION BY s.template_id ORDER BY d.sort_order, d.created_at, d.id, s.sort_order, s.created_at, s.id, k.sort_order, k.created_at, k.id) AS new_code
  FROM kpis k
  JOIN kpi_standards s ON s.id = k.standard_id
  JOIN kpi_domains d ON d.id = s.domain_id
)
UPDATE kpis k SET code = numbered.new_code FROM numbered WHERE k.id = numbered.id;

ALTER TABLE "kpi_domains" ALTER COLUMN "code" SET NOT NULL;
ALTER TABLE "kpi_standards" ALTER COLUMN "code" SET NOT NULL;
ALTER TABLE "kpi_standards" ALTER COLUMN "template_id" SET NOT NULL;
ALTER TABLE "kpis" ALTER COLUMN "code" SET NOT NULL;
ALTER TABLE "kpis" ALTER COLUMN "template_id" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "kpi_domains_template_id_code_key" ON "kpi_domains" ("template_id", "code");
CREATE UNIQUE INDEX IF NOT EXISTS "kpi_standards_template_id_code_key" ON "kpi_standards" ("template_id", "code");
CREATE UNIQUE INDEX IF NOT EXISTS "kpis_template_id_code_key" ON "kpis" ("template_id", "code");
CREATE INDEX IF NOT EXISTS "kpi_standards_template_id_idx" ON "kpi_standards" ("template_id");
CREATE INDEX IF NOT EXISTS "kpis_template_id_idx" ON "kpis" ("template_id");

ALTER TABLE "kpi_standards" DROP CONSTRAINT IF EXISTS "kpi_standards_template_id_fkey";
ALTER TABLE "kpi_standards" ADD CONSTRAINT "kpi_standards_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "rubric_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "kpis" DROP CONSTRAINT IF EXISTS "kpis_template_id_fkey";
ALTER TABLE "kpis" ADD CONSTRAINT "kpis_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "rubric_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION fill_kpi_domain_code() RETURNS trigger AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := 'D' || (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM kpi_domains WHERE template_id = NEW.template_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fill_kpi_standard_code() RETURNS trigger AS $$
BEGIN
  IF NEW.template_id IS NULL THEN
    SELECT template_id INTO NEW.template_id FROM kpi_domains WHERE id = NEW.domain_id;
  END IF;
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := 'S' || (SELECT COUNT(*) + 1 FROM kpi_standards WHERE template_id = NEW.template_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fill_kpi_code() RETURNS trigger AS $$
BEGIN
  IF NEW.template_id IS NULL THEN
    SELECT template_id INTO NEW.template_id FROM kpi_standards WHERE id = NEW.standard_id;
  END IF;
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := 'K' || (SELECT COUNT(*) + 1 FROM kpis WHERE template_id = NEW.template_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fill_kpi_domain_code ON kpi_domains;
CREATE TRIGGER trg_fill_kpi_domain_code BEFORE INSERT ON kpi_domains FOR EACH ROW EXECUTE FUNCTION fill_kpi_domain_code();
DROP TRIGGER IF EXISTS trg_fill_kpi_standard_code ON kpi_standards;
CREATE TRIGGER trg_fill_kpi_standard_code BEFORE INSERT ON kpi_standards FOR EACH ROW EXECUTE FUNCTION fill_kpi_standard_code();
DROP TRIGGER IF EXISTS trg_fill_kpi_code ON kpis;
CREATE TRIGGER trg_fill_kpi_code BEFORE INSERT ON kpis FOR EACH ROW EXECUTE FUNCTION fill_kpi_code();

CREATE TABLE IF NOT EXISTS "strategic_plans" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "department_id" UUID NOT NULL UNIQUE REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "vision" TEXT,
  "mission" TEXT,
  "start_year" INTEGER NOT NULL,
  "end_year" INTEGER NOT NULL,
  "status" "StrategicPlanStatus" NOT NULL DEFAULT 'draft',
  "owner_user_id" UUID REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "published_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "strategic_periods" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "plan_id" UUID NOT NULL REFERENCES "strategic_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "label" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "sort_order" INTEGER NOT NULL,
  CONSTRAINT "strategic_periods_plan_id_year_key" UNIQUE ("plan_id", "year"),
  CONSTRAINT "strategic_periods_plan_id_sort_order_key" UNIQUE ("plan_id", "sort_order")
);

CREATE TABLE IF NOT EXISTS "strategic_goals" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "plan_id" UUID NOT NULL REFERENCES "strategic_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "number" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "sort_order" INTEGER NOT NULL,
  CONSTRAINT "strategic_goals_plan_id_number_key" UNIQUE ("plan_id", "number"),
  CONSTRAINT "strategic_goals_plan_id_sort_order_key" UNIQUE ("plan_id", "sort_order")
);

CREATE TABLE IF NOT EXISTS "strategic_objectives" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "goal_id" UUID NOT NULL REFERENCES "strategic_goals"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "number" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL,
  CONSTRAINT "strategic_objectives_goal_id_number_key" UNIQUE ("goal_id", "number"),
  CONSTRAINT "strategic_objectives_goal_id_sort_order_key" UNIQUE ("goal_id", "sort_order")
);

CREATE TABLE IF NOT EXISTS "strategic_programs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "objective_id" UUID NOT NULL REFERENCES "strategic_objectives"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "ProgramStatus" NOT NULL DEFAULT 'not_started',
  "sort_order" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "strategic_programs_objective_id_code_key" UNIQUE ("objective_id", "code"),
  CONSTRAINT "strategic_programs_objective_id_sort_order_key" UNIQUE ("objective_id", "sort_order")
);

CREATE TABLE IF NOT EXISTS "program_checklist_items" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "program_id" UUID NOT NULL REFERENCES "strategic_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "text" TEXT NOT NULL,
  "done" BOOLEAN NOT NULL DEFAULT false,
  "sort_order" INTEGER NOT NULL,
  CONSTRAINT "program_checklist_items_program_id_sort_order_key" UNIQUE ("program_id", "sort_order")
);

CREATE TABLE IF NOT EXISTS "program_kpi_links" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "program_id" UUID NOT NULL REFERENCES "strategic_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "kpi_id" UUID NOT NULL REFERENCES "kpis"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "coverage_label" TEXT,
  CONSTRAINT "program_kpi_links_program_id_kpi_id_key" UNIQUE ("program_id", "kpi_id")
);

CREATE TABLE IF NOT EXISTS "program_period_targets" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "program_id" UUID NOT NULL REFERENCES "strategic_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "period_id" UUID NOT NULL REFERENCES "strategic_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "target_text" TEXT NOT NULL DEFAULT '',
  "actual_text" TEXT,
  "status" "ProgramStatus" NOT NULL DEFAULT 'not_started',
  "evidence_key" TEXT,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "program_period_targets_program_id_period_id_key" UNIQUE ("program_id", "period_id")
);

CREATE TABLE IF NOT EXISTS "program_collaborators" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "program_id" UUID NOT NULL REFERENCES "strategic_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "department_id" UUID NOT NULL REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "program_collaborators_program_id_department_id_key" UNIQUE ("program_id", "department_id")
);

CREATE TABLE IF NOT EXISTS "program_budget_lines" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "program_id" UUID NOT NULL REFERENCES "strategic_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "period_id" UUID NOT NULL REFERENCES "strategic_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "amount_idr" DECIMAL(15, 2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS "program_progress_updates" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "program_id" UUID NOT NULL REFERENCES "strategic_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "author_id" UUID NOT NULL REFERENCES "users"("id") ON UPDATE CASCADE,
  "note" TEXT NOT NULL,
  "status" "ProgramStatus" NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "strategic_plans_status_idx" ON "strategic_plans"("status");
CREATE INDEX IF NOT EXISTS "strategic_periods_plan_id_idx" ON "strategic_periods"("plan_id");
CREATE INDEX IF NOT EXISTS "strategic_goals_plan_id_idx" ON "strategic_goals"("plan_id");
CREATE INDEX IF NOT EXISTS "strategic_objectives_goal_id_idx" ON "strategic_objectives"("goal_id");
CREATE INDEX IF NOT EXISTS "strategic_programs_objective_id_idx" ON "strategic_programs"("objective_id");
CREATE INDEX IF NOT EXISTS "program_checklist_items_program_id_idx" ON "program_checklist_items"("program_id");
CREATE INDEX IF NOT EXISTS "program_kpi_links_program_id_idx" ON "program_kpi_links"("program_id");
CREATE INDEX IF NOT EXISTS "program_kpi_links_kpi_id_idx" ON "program_kpi_links"("kpi_id");
CREATE INDEX IF NOT EXISTS "program_period_targets_program_id_idx" ON "program_period_targets"("program_id");
CREATE INDEX IF NOT EXISTS "program_period_targets_period_id_idx" ON "program_period_targets"("period_id");
CREATE INDEX IF NOT EXISTS "program_collaborators_program_id_idx" ON "program_collaborators"("program_id");
CREATE INDEX IF NOT EXISTS "program_collaborators_department_id_idx" ON "program_collaborators"("department_id");
CREATE INDEX IF NOT EXISTS "program_budget_lines_program_id_idx" ON "program_budget_lines"("program_id");
CREATE INDEX IF NOT EXISTS "program_budget_lines_period_id_idx" ON "program_budget_lines"("period_id");
CREATE INDEX IF NOT EXISTS "program_progress_updates_program_id_idx" ON "program_progress_updates"("program_id");
CREATE INDEX IF NOT EXISTS "program_progress_updates_author_id_idx" ON "program_progress_updates"("author_id");
