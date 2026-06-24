-- ============================================================
-- Fix: Add gen_random_uuid() as database-level default for UUID id
--      columns that were missing a DEFAULT clause.
--
-- Root cause: Prisma's @default(uuid()) is application-level only.
-- The initial migration.sql generated UUID NOT NULL with no DEFAULT,
-- causing "null value in column id violates not-null constraint"
-- whenever rows are inserted without an explicit id value
-- (e.g. Google Sign-In user creation in auth.ts).
-- ============================================================

-- Enable pgcrypto extension (provides gen_random_uuid on PG < 13)
-- On PG 13+ gen_random_uuid() is built-in, but this is harmless.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- departments.id
ALTER TABLE "departments"
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- users.id
ALTER TABLE "users"
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- profiles.id
ALTER TABLE "profiles"
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- user_roles.id
ALTER TABLE "user_roles"
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- rubric_templates.id
ALTER TABLE "rubric_templates"
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- rubric_sections.id
ALTER TABLE "rubric_sections"
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- rubric_indicators.id
ALTER TABLE "rubric_indicators"
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- kpi_domains.id
ALTER TABLE "kpi_domains"
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- kpi_standards.id
ALTER TABLE "kpi_standards"
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- kpis.id
ALTER TABLE "kpis"
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- department_roles.id
ALTER TABLE "department_roles"
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- approval_workflows.id
ALTER TABLE "approval_workflows"
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- assessments.id
ALTER TABLE "assessments"
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- assessment_questions.id
ALTER TABLE "assessment_questions"
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
