-- Migration: Fix Director Assignment for Existing Assessments
-- This assigns the director to all existing assessments that don't have one

-- Update all assessments that don't have a director assigned
-- This will assign the first user with the 'director' role
UPDATE "assessments"
SET "director_id" = (
    SELECT "user_id"
    FROM "user_roles"
    WHERE "role" = 'director'
    LIMIT 1
)
WHERE "director_id" IS NULL;
