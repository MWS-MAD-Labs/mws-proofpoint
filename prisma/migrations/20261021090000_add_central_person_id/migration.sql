ALTER TABLE users
  ADD COLUMN central_person_id TEXT;

CREATE UNIQUE INDEX users_central_person_id_key
  ON users (central_person_id)
  WHERE central_person_id IS NOT NULL;
