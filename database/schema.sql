-- ProofPoint Dashboard Database Schema
-- Self-hosted PostgreSQL (migrated from Supabase)

-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'staff', 'manager', 'director', 'supervisor');

-- Create departments table (org tree structure)
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create users table (replaces Supabase auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email TEXT NOT NULL,
  full_name TEXT,
  niy TEXT,
  job_title TEXT,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'staff',
  UNIQUE (user_id, role)
);

-- Create rubric templates table
CREATE TABLE public.rubric_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  is_global BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create rubric sections table
CREATE TABLE public.rubric_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES public.rubric_templates(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  weight DECIMAL(5,2) NOT NULL CHECK (weight >= 0 AND weight <= 100),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create rubric indicators table
CREATE TABLE public.rubric_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID REFERENCES public.rubric_sections(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  evidence_guidance TEXT,
  score_options JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create assessments table
CREATE TABLE public.assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  manager_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  director_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  template_id UUID REFERENCES public.rubric_templates(id) ON DELETE SET NULL,
  period TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'self_submitted', 'manager_reviewed', 'director_approved', 'acknowledged', 'rejected', 'returned')
  ),
  staff_scores JSONB DEFAULT '{}',
  manager_scores JSONB DEFAULT '{}',
  staff_evidence JSONB DEFAULT '{}',
  manager_evidence JSONB DEFAULT '{}',
  manager_notes TEXT,
  director_comments TEXT,
  return_feedback TEXT,
  returned_at TIMESTAMPTZ,
  returned_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  final_score DECIMAL(4,2),
  final_grade TEXT,
  staff_submitted_at TIMESTAMPTZ,
  manager_reviewed_at TIMESTAMPTZ,
  director_approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create assessment questions table
CREATE TABLE public.assessment_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID REFERENCES public.assessments(id) ON DELETE CASCADE NOT NULL,
  indicator_id UUID REFERENCES public.rubric_indicators(id) ON DELETE SET NULL,
  asked_by UUID NOT NULL REFERENCES public.users(id),
  question TEXT NOT NULL,
  response TEXT,
  responded_by UUID REFERENCES public.users(id),
  responded_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'answered', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_profiles_department_id ON public.profiles(department_id);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_assessments_staff_id ON public.assessments(staff_id);
CREATE INDEX idx_assessments_manager_id ON public.assessments(manager_id);
CREATE INDEX idx_assessments_director_id ON public.assessments(director_id);
CREATE INDEX idx_assessments_status ON public.assessments(status);
CREATE INDEX idx_assessment_questions_assessment_id ON public.assessment_questions(assessment_id);

-- Utility functions
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update triggers
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_departments_updated_at
  BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rubric_templates_updated_at
  BEFORE UPDATE ON public.rubric_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_assessments_updated_at
  BEFORE UPDATE ON public.assessments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_assessment_questions_updated_at
  BEFORE UPDATE ON public.assessment_questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
