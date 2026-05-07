-- Migration: Add return feedback columns to assessments table
-- This enables managers/directors to return assessments to staff for revision

-- Add return feedback columns
ALTER TABLE assessments
  ADD COLUMN IF NOT EXISTS return_feedback TEXT,
  ADD COLUMN IF NOT EXISTS returned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS returned_by UUID REFERENCES users(id);

-- Drop existing constraint and add updated one with 'returned' and 'admin_reviewed' status
ALTER TABLE assessments DROP CONSTRAINT IF EXISTS assessments_status_check;
ALTER TABLE assessments ADD CONSTRAINT assessments_status_check
  CHECK (status IN ('draft', 'self_submitted', 'manager_reviewed', 'director_approved', 'admin_reviewed', 'acknowledged', 'rejected', 'returned'));

-- Create index for returned_by for faster lookups
CREATE INDEX IF NOT EXISTS idx_assessments_returned_by ON assessments(returned_by);
