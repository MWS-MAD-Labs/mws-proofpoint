-- Performance Tracker Migration
-- Adds tables for personal KPI progress tracking with artifacts and links

-- Performance entries (one per KPI update by user)
CREATE TABLE IF NOT EXISTS public.performance_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  kpi_id UUID REFERENCES public.kpis(id) ON DELETE CASCADE NOT NULL,
  template_id UUID REFERENCES public.rubric_templates(id) ON DELETE SET NULL,
  period TEXT NOT NULL, -- e.g., "2024-2025 Semester 1"
  claimed_score INTEGER NOT NULL CHECK (claimed_score BETWEEN 1 AND 4),
  evidence_description TEXT NOT NULL,
  notes TEXT,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Artifacts attached to performance entries (files and links)
CREATE TABLE IF NOT EXISTS public.performance_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID REFERENCES public.performance_entries(id) ON DELETE CASCADE NOT NULL,
  artifact_type TEXT NOT NULL CHECK (artifact_type IN ('file', 'link')),
  -- For files
  file_name TEXT,
  file_key TEXT, -- MinIO storage key
  file_url TEXT,
  file_type TEXT,
  file_size INTEGER,
  -- For links
  link_url TEXT,
  link_title TEXT,
  -- Common
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_performance_entries_user_id ON public.performance_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_performance_entries_kpi_id ON public.performance_entries(kpi_id);
CREATE INDEX IF NOT EXISTS idx_performance_entries_period ON public.performance_entries(period);
CREATE INDEX IF NOT EXISTS idx_performance_entries_template_id ON public.performance_entries(template_id);
CREATE INDEX IF NOT EXISTS idx_performance_artifacts_entry_id ON public.performance_artifacts(entry_id);

-- Update trigger for performance_entries
CREATE TRIGGER update_performance_entries_updated_at
  BEFORE UPDATE ON public.performance_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
