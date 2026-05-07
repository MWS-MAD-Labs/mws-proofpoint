-- Migration: 20260501000000_add_workflow_definitions
-- Adds the workflow definition system for Milestone 1
-- Uses DO $$ ... EXCEPTION blocks to avoid "already exists" errors on re-run

-- ─── 1. Add TemplateType enum (safe check) ───────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "TemplateType" AS ENUM (
    'KPI_APPRAISAL',
    'CLASSROOM_OBSERVATION',
    'GENERIC'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ─── 2. Add WorkflowActionType enum (safe check) ─────────────────────────────
DO $$ BEGIN
  CREATE TYPE "WorkflowActionType" AS ENUM (
    'FILL_FORM',
    'ACKNOWLEDGE',
    'REVIEW',
    'APPROVE'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ─── 3. Add template_type column to rubric_templates ─────────────────────────
ALTER TABLE "rubric_templates"
ADD COLUMN IF NOT EXISTS "template_type" "TemplateType" NOT NULL DEFAULT 'KPI_APPRAISAL';

-- ─── 4. Create workflow_definitions table ────────────────────────────────────
CREATE TABLE IF NOT EXISTS "workflow_definitions" (
    "id"          TEXT         NOT NULL DEFAULT gen_random_uuid(),
    "name"        TEXT         NOT NULL,
    "type"        "TemplateType" NOT NULL,
    "description" TEXT,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_definitions_pkey" PRIMARY KEY ("id")
);

-- ─── 5. Create workflow_steps table ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "workflow_steps" (
    "id"          TEXT                  NOT NULL DEFAULT gen_random_uuid(),
    "workflow_id" TEXT                  NOT NULL,
    "step_order"  INTEGER               NOT NULL,
    "actor_role"  "AppRole"             NOT NULL,
    "action_type" "WorkflowActionType"  NOT NULL,
    "description" TEXT,

    CONSTRAINT "workflow_steps_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "workflow_steps_workflow_id_fkey"
        FOREIGN KEY ("workflow_id")
        REFERENCES "workflow_definitions"("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "workflow_steps_workflow_id_idx"
    ON "workflow_steps"("workflow_id");

-- ─── 6. Create role_workflow_assignments table ────────────────────────────────
CREATE TABLE IF NOT EXISTS "role_workflow_assignments" (
    "id"                 TEXT         NOT NULL DEFAULT gen_random_uuid(),
    "department_role_id" TEXT         NOT NULL,
    "workflow_id"        TEXT         NOT NULL,
    "rubric_id"          TEXT,
    "is_active"          BOOLEAN      NOT NULL DEFAULT true,
    "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_workflow_assignments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "role_workflow_assignments_dept_role_fkey"
        FOREIGN KEY ("department_role_id")
        REFERENCES "department_roles"("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT "role_workflow_assignments_workflow_fkey"
        FOREIGN KEY ("workflow_id")
        REFERENCES "workflow_definitions"("id")
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT "role_workflow_assignments_rubric_fkey"
        FOREIGN KEY ("rubric_id")
        REFERENCES "rubric_templates"("id")
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "role_workflow_assignments_dept_role_idx"
    ON "role_workflow_assignments"("department_role_id");
