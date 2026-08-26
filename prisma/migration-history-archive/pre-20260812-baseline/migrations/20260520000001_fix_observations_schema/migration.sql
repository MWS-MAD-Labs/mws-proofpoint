-- Rename rubricId -> template_id
ALTER TABLE observations RENAME COLUMN "rubricId" TO "template_id";

-- Drop kolom yang tidak ada di schema baru
ALTER TABLE observations DROP COLUMN IF EXISTS "type";
ALTER TABLE observations DROP COLUMN IF EXISTS "title";
ALTER TABLE observations DROP COLUMN IF EXISTS "description";
ALTER TABLE observations DROP COLUMN IF EXISTS "workflow_definition_id";
ALTER TABLE observations DROP COLUMN IF EXISTS "created_by_id";
ALTER TABLE observations DROP COLUMN IF EXISTS "acknowledged_by";

-- Rename index yang pakai rubricId lama jika ada
DROP INDEX IF EXISTS "observations_rubricId_idx";