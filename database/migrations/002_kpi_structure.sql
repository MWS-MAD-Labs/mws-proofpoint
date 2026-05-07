-- KPI Structure Migration
-- Adds Domain → Standard → KPI hierarchy

-- Create kpi_domains table
CREATE TABLE IF NOT EXISTS public.kpi_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES public.rubric_templates(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create kpi_standards table
CREATE TABLE IF NOT EXISTS public.kpi_standards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id UUID REFERENCES public.kpi_domains(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create kpis table (replacing rubric_indicators concept)
CREATE TABLE IF NOT EXISTS public.kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  standard_id UUID REFERENCES public.kpi_standards(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  evidence_guidance TEXT,
  trainings TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  rubric_4 TEXT NOT NULL,
  rubric_3 TEXT NOT NULL,
  rubric_2 TEXT NOT NULL,
  rubric_1 TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_kpi_domains_template_id ON public.kpi_domains(template_id);
CREATE INDEX IF NOT EXISTS idx_kpi_standards_domain_id ON public.kpi_standards(domain_id);
CREATE INDEX IF NOT EXISTS idx_kpis_standard_id ON public.kpis(standard_id);

-- Add staff_notes column to assessments if not exists (for acknowledgment workflow)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assessments' AND column_name = 'staff_notes') THEN
    ALTER TABLE public.assessments ADD COLUMN staff_notes TEXT;
  END IF;
END $$;
