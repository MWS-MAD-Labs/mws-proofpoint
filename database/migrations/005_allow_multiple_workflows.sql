-- Migration: Allow multiple workflows per role
-- Remove the unique constraint to allow multiple named configurations for the same role/department

BEGIN;

ALTER TABLE public.department_roles DROP CONSTRAINT IF EXISTS department_roles_dept_role_unique;

COMMIT;
