-- prisma/migrations/YYYYMMDDHHMMSS_add_observations/migration.sql
-- Jalankan: npx prisma migrate dev --name add_observations
-- Atau untuk production: npx prisma migrate deploy

-- ─── Enums ────────────────────────────────────────────────────────────────────

-- ObservationStatus: tambah 'pending' dan 'reviewed'
DO $$ BEGIN
  CREATE TYPE "ObservationStatus" AS ENUM (
    'draft',
    'pending',
    'submitted',
    'reviewed',
    'acknowledged'
  );
EXCEPTION
  WHEN duplicate_object THEN
    -- Tambah nilai baru jika enum sudah ada
    BEGIN
      ALTER TYPE "ObservationStatus" ADD VALUE IF NOT EXISTS 'pending';
    EXCEPTION WHEN others THEN NULL; END;
    BEGIN
      ALTER TYPE "ObservationStatus" ADD VALUE IF NOT EXISTS 'reviewed';
    EXCEPTION WHEN others THEN NULL; END;
END $$;

-- ObservationType
DO $$ BEGIN
  CREATE TYPE "ObservationType" AS ENUM ('SELF', 'MANAGER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ─── Table: observations ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "observations" (
  "id"              TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "staffId"         TEXT NOT NULL,
  "managerId"       TEXT,
  "director_id"     TEXT,
  "rubricId"        TEXT NOT NULL,
  "status"          "ObservationStatus" NOT NULL DEFAULT 'draft',
  "type"            "ObservationType" NOT NULL DEFAULT 'MANAGER',
  "title"           TEXT,
  "description"     TEXT,
  "submitted_at"    TIMESTAMP(3),
  "acknowledged_at" TIMESTAMP(3),
  "acknowledged_by" TEXT,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "observations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "observations_staffId_fkey"
    FOREIGN KEY ("staffId") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "observations_managerId_fkey"
    FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "observations_director_id_fkey"
    FOREIGN KEY ("director_id") REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "observations_rubricId_fkey"
    FOREIGN KEY ("rubricId") REFERENCES "rubric_templates"("id") ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "observations_staffId_idx"    ON "observations"("staffId");
CREATE INDEX IF NOT EXISTS "observations_managerId_idx"  ON "observations"("managerId");
CREATE INDEX IF NOT EXISTS "observations_status_idx"     ON "observations"("status");
CREATE INDEX IF NOT EXISTS "observations_created_at_idx" ON "observations"("created_at");

-- ─── Table: observation_answers ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "observation_answers" (
  "id"              TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "observation_id"  TEXT NOT NULL,
  "indicator_id"    TEXT NOT NULL,
  "score"           INTEGER NOT NULL DEFAULT 0,
  "note"            VARCHAR(1000),
  "evidence"        TEXT,
  "evidence_file"   TEXT,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "observation_answers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "observation_answers_observationId_indicatorId_key"
    UNIQUE ("observation_id", "indicator_id"),
  CONSTRAINT "observation_answers_observation_id_fkey"
    FOREIGN KEY ("observation_id") REFERENCES "observations"("id") ON DELETE CASCADE,
  CONSTRAINT "observation_answers_indicator_id_fkey"
    FOREIGN KEY ("indicator_id") REFERENCES "rubric_indicators"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "observation_answers_observation_id_idx" ON "observation_answers"("observation_id");
CREATE INDEX IF NOT EXISTS "observation_answers_indicator_id_idx"   ON "observation_answers"("indicator_id");

-- ─── Table: observation_updates (audit trail) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS "observation_updates" (
  "id"              TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "observation_id"  TEXT NOT NULL,
  "updated_by"      TEXT NOT NULL,
  "statusFrom"      "ObservationStatus" NOT NULL,
  "statusTo"        "ObservationStatus" NOT NULL,
  "notes"           TEXT,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "observation_updates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "observation_updates_observation_id_fkey"
    FOREIGN KEY ("observation_id") REFERENCES "observations"("id") ON DELETE CASCADE,
  CONSTRAINT "observation_updates_updated_by_fkey"
    FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "observation_updates_observation_id_idx" ON "observation_updates"("observation_id");
CREATE INDEX IF NOT EXISTS "observation_updates_updated_by_idx"     ON "observation_updates"("updated_by");

-- ─── Add observationUpdates relation to users (backref) ──────────────────────
-- Tidak perlu DDL tambahan karena relasinya hanya di Prisma schema.

-- ─── Trigger: auto-update updated_at ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER set_observations_updated_at
    BEFORE UPDATE ON "observations"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER set_observation_answers_updated_at
    BEFORE UPDATE ON "observation_answers"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
