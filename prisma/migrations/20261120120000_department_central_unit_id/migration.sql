ALTER TABLE departments
  ADD COLUMN central_unit_id TEXT;

CREATE UNIQUE INDEX departments_central_unit_id_key
  ON departments (central_unit_id)
  WHERE central_unit_id IS NOT NULL;
