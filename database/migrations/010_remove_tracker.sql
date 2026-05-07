-- Remove Tracker Features Migration
-- Drops all tables and indexes related to performance tracking and work tasks

-- Drop work task tables (in order of dependencies)
DROP TABLE IF EXISTS public.work_task_kpis CASCADE;
DROP TABLE IF EXISTS public.work_subtasks CASCADE;
DROP TABLE IF EXISTS public.work_tasks CASCADE;

-- Drop performance tracking tables (in order of dependencies)
DROP TABLE IF EXISTS public.performance_artifacts CASCADE;
DROP TABLE IF EXISTS public.performance_entries CASCADE;

-- Note: The triggers will be automatically dropped when the tables are dropped
