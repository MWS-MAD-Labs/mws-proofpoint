-- Preserve the existing department ID and its appraisal history before the
-- Central Unit named "MAD Lab" is linked by the next structure sync.
UPDATE departments
   SET name = 'MAD Lab',
       updated_at = NOW()
 WHERE lower(trim(name)) = 'mad labs'
   AND NOT EXISTS (
     SELECT 1 FROM departments existing
      WHERE lower(trim(existing.name)) = 'mad lab'
        AND existing.id <> departments.id
   );
