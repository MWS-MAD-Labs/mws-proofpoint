-- Legacy deployments store assessments.status as TEXT constrained by a check
-- constraint. Include the manager-led workflow statuses alongside all existing
-- legacy statuses.

ALTER TABLE assessments
  DROP CONSTRAINT IF EXISTS assessments_status_check;

ALTER TABLE assessments
  ADD CONSTRAINT assessments_status_check
  CHECK (
    status IN (
      'draft',
      'self_submitted',
      'manager_reviewed',
      'pending_director_review',
      'director_reviewed',
      'director_approved',
      'admin_reviewed',
      'acknowledged',
      'rejected',
      'returned',
      'pending_release'
    )
  );
