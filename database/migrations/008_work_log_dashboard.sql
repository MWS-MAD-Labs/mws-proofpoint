-- Enhanced Work Log Dashboard Migration
-- Adds work_tasks with subtasks, KPI linking, and enhanced artifact support

-- Work log tasks (main entity for tracking work)
CREATE TABLE IF NOT EXISTS public.work_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  template_id UUID REFERENCES public.rubric_templates(id) ON DELETE SET NULL,
  period TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  progress INTEGER DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  due_date DATE,
  completed_at TIMESTAMPTZ,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Subtasks/checklist items within a task
CREATE TABLE IF NOT EXISTS public.work_subtasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES public.work_tasks(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- KPI links for tasks (many-to-many: task can contribute to multiple KPIs)
CREATE TABLE IF NOT EXISTS public.work_task_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES public.work_tasks(id) ON DELETE CASCADE NOT NULL,
  kpi_id UUID REFERENCES public.kpis(id) ON DELETE CASCADE NOT NULL,
  claimed_score INTEGER CHECK (claimed_score BETWEEN 1 AND 4),
  evidence_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(task_id, kpi_id)
);

-- Add task_id to existing performance_artifacts for reuse
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'performance_artifacts' AND column_name = 'task_id'
  ) THEN
    ALTER TABLE public.performance_artifacts 
      ADD COLUMN task_id UUID REFERENCES public.work_tasks(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_work_tasks_user_id ON public.work_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_work_tasks_status ON public.work_tasks(status);
CREATE INDEX IF NOT EXISTS idx_work_tasks_period ON public.work_tasks(period);
CREATE INDEX IF NOT EXISTS idx_work_tasks_template_id ON public.work_tasks(template_id);
CREATE INDEX IF NOT EXISTS idx_work_subtasks_task_id ON public.work_subtasks(task_id);
CREATE INDEX IF NOT EXISTS idx_work_task_kpis_task_id ON public.work_task_kpis(task_id);
CREATE INDEX IF NOT EXISTS idx_work_task_kpis_kpi_id ON public.work_task_kpis(kpi_id);
CREATE INDEX IF NOT EXISTS idx_performance_artifacts_task_id ON public.performance_artifacts(task_id);

-- Update trigger for work_tasks
DROP TRIGGER IF EXISTS update_work_tasks_updated_at ON public.work_tasks;
CREATE TRIGGER update_work_tasks_updated_at
  BEFORE UPDATE ON public.work_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
