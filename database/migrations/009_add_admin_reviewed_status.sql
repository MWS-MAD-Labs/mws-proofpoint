-- Migration: Add admin_reviewed status to assessments
-- This enables admins to release assessments after director approval

-- Drop existing constraint and add updated one with 'admin_reviewed' status
ALTER TABLE assessments DROP CONSTRAINT IF EXISTS assessments_status_check;
ALTER TABLE assessments ADD CONSTRAINT assessments_status_check
  CHECK (status IN ('draft', 'self_submitted', 'manager_reviewed', 'director_approved', 'admin_reviewed', 'acknowledged', 'rejected', 'returned'));
