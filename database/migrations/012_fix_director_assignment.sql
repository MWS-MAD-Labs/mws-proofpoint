-- Migration: Fix Director Assignment for Existing Assessments
-- Date: 2025-02-22
-- Description: Assigns director_id to all assessments that have NULL director_id
-- This ensures the print report shows the actual director name instead of placeholder

BEGIN;

-- First, let's see how many assessments need updating (for verification)
SELECT
    COUNT(*) as total_assessments,
    COUNT(director_id) as with_director,
    COUNT(*) - COUNT(director_id) as without_director
FROM assessments;

-- Update all assessments that don't have a director assigned
-- This will assign the first user with the 'director' role
UPDATE assessments
SET director_id = (
    SELECT ur.user_id
    FROM user_roles ur
    JOIN profiles p ON ur.user_id = p.user_id
    WHERE ur.role = 'director'
    LIMIT 1
)
WHERE director_id IS NULL;

-- Verify the update was successful
SELECT
    a.id,
    sp.full_name as staff_name,
    dp.full_name as director_name,
    dp.job_title as director_job_title
FROM assessments a
LEFT JOIN profiles sp ON a.staff_id = sp.user_id
LEFT JOIN profiles dp ON a.director_id = dp.user_id
ORDER BY a.created_at DESC
LIMIT 5;

-- Show final count to confirm all assessments have directors
SELECT
    COUNT(*) as total_assessments,
    COUNT(director_id) as with_director,
    COUNT(*) - COUNT(director_id) as without_director
FROM assessments;

COMMIT;

-- If you need to rollback, use this:
-- UPDATE assessments SET director_id = NULL WHERE director_id IS NOT NULL;
