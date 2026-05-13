DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ObservationStatus') THEN
    CREATE TYPE "ObservationStatus" AS ENUM (
      'draft',
      'pending',
      'submitted',
      'reviewed',
      'acknowledged'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "observations" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "staffId" TEXT NOT NULL,
  "managerId" TEXT,
  "rubricId" TEXT NOT NULL,
  "status" "ObservationStatus" NOT NULL DEFAULT 'draft',
  "type" TEXT NOT NULL DEFAULT 'MANAGER',
  "title" TEXT,
  "description" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submitted_at" TIMESTAMP(3),
  "acknowledged_at" TIMESTAMP(3),
  CONSTRAINT "observations_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "observations_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "observations_rubricId_fkey" FOREIGN KEY ("rubricId") REFERENCES "rubric_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "observation_answers" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "observation_id" TEXT NOT NULL,
  "indicator_id" TEXT NOT NULL,
  "score" INTEGER NOT NULL DEFAULT 0,
  "note" TEXT,
  "evidence" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "observation_answers_observation_id_fkey" FOREIGN KEY ("observation_id") REFERENCES "observations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "observation_answers_indicator_id_fkey" FOREIGN KEY ("indicator_id") REFERENCES "rubric_indicators"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "observation_updates" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "observation_id" TEXT NOT NULL,
  "updated_by_id" TEXT,
  "status_from" TEXT,
  "status_to" TEXT NOT NULL,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "observation_updates_observation_id_fkey" FOREIGN KEY ("observation_id") REFERENCES "observations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "observation_updates_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "observation_answers_observation_id_indicator_id_key"
  ON "observation_answers"("observation_id", "indicator_id");
CREATE INDEX IF NOT EXISTS "observations_staffId_idx" ON "observations"("staffId");
CREATE INDEX IF NOT EXISTS "observations_managerId_idx" ON "observations"("managerId");
CREATE INDEX IF NOT EXISTS "observations_rubricId_idx" ON "observations"("rubricId");
CREATE INDEX IF NOT EXISTS "observations_status_idx" ON "observations"("status");
CREATE INDEX IF NOT EXISTS "observation_answers_indicator_id_idx" ON "observation_answers"("indicator_id");
CREATE INDEX IF NOT EXISTS "observation_updates_observation_id_idx" ON "observation_updates"("observation_id");
CREATE INDEX IF NOT EXISTS "observation_updates_updated_by_id_idx" ON "observation_updates"("updated_by_id");
