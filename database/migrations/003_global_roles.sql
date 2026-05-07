-- Migration: Global Roles Support
-- Allow department_id to be NULL for global roles (like Director)
-- Use NULLS NOT DISTINCT for unique constraints (PostgreSQL 15+)

BEGIN;

-- 1. Drop the old unique constraint
ALTER TABLE public.department_roles DROP CONSTRAINT IF EXISTS department_roles_department_id_role_key;

-- 2. Make department_id nullable
ALTER TABLE public.department_roles ALTER COLUMN department_id DROP NOT NULL;

-- 3. Add new unique constraint with NULLS NOT DISTINCT (supported in PG 16)
-- This allows (NULL, 'admin') to be unique globally.
ALTER TABLE public.department_roles 
ADD CONSTRAINT department_roles_dept_role_unique 
UNIQUE NULLS NOT DISTINCT (department_id, role);

-- 4. Update approval_workflows to ensure consistency
-- (No structural change needed, but good to check foreign keys)

COMMIT;

-- Global roles migration completed successfully
