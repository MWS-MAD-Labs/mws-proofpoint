-- Migration: Admin Features
-- Add tables and columns to support admin functionality
-- Run after schema.sql

-- =====================================================
-- Add job_title to profiles
-- =====================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS job_title TEXT;

-- =====================================================
-- Department roles configuration
-- Links departments to roles with default KPI templates
-- =====================================================
CREATE TABLE IF NOT EXISTS public.department_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  default_template_id UUID REFERENCES public.rubric_templates(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (department_id, role)
);

-- =====================================================
-- Approval workflows per department role
-- Configurable approval chain steps
-- =====================================================
CREATE TABLE IF NOT EXISTS public.approval_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_role_id UUID REFERENCES public.department_roles(id) ON DELETE CASCADE NOT NULL,
  step_order INTEGER NOT NULL,
  approver_role app_role NOT NULL,
  step_type TEXT NOT NULL CHECK (step_type IN ('review', 'approval', 'review_and_approval', 'acknowledge')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (department_role_id, step_order)
);

-- =====================================================
-- User status (for soft delete/suspend)
-- =====================================================
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted'));

-- =====================================================
-- Indexes
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_department_roles_department_id ON public.department_roles(department_id);
CREATE INDEX IF NOT EXISTS idx_department_roles_role ON public.department_roles(role);
CREATE INDEX IF NOT EXISTS idx_approval_workflows_department_role_id ON public.approval_workflows(department_role_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(status);

-- =====================================================
-- Update triggers
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_department_roles_updated_at ON public.department_roles;
CREATE TRIGGER update_department_roles_updated_at
  BEFORE UPDATE ON public.department_roles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- Seed default approval workflows
-- Only insert if tables are empty (first-time setup)
-- =====================================================
DO $$
BEGIN
  -- This block just adds the schema, actual workflow configs will be added via admin UI
  RAISE NOTICE 'Admin features migration completed successfully';
END $$;
