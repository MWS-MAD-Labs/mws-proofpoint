-- Migration: Workflow Naming Support
-- Add a name column to department_roles to allow custom workflow naming

BEGIN;

ALTER TABLE public.department_roles ADD COLUMN name TEXT;

COMMIT;
