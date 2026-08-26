-- Notification enums
DO $$
BEGIN
  CREATE TYPE "NotificationType" AS ENUM (
    'assessment_submitted',
    'manager_review_completed',
    'director_approved',
    'admin_released',
    'assessment_returned',
    'assessment_acknowledged'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "NotificationStatus" AS ENUM ('pending', 'sent', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Notification logs
CREATE TABLE IF NOT EXISTS "notifications" (
  "id" SERIAL PRIMARY KEY,
  "assessment_id" TEXT,
  "user_id" TEXT,
  "type" "NotificationType" NOT NULL,
  "status" "NotificationStatus" NOT NULL DEFAULT 'pending',
  "error" TEXT,
  "sent_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- User notification preferences
CREATE TABLE IF NOT EXISTS "notification_preferences" (
  "id" SERIAL PRIMARY KEY,
  "user_id" TEXT NOT NULL UNIQUE,
  "email_enabled" BOOLEAN NOT NULL DEFAULT true,
  "assessment_submitted" BOOLEAN NOT NULL DEFAULT true,
  "manager_review_done" BOOLEAN NOT NULL DEFAULT true,
  "director_approved" BOOLEAN NOT NULL DEFAULT true,
  "admin_released" BOOLEAN NOT NULL DEFAULT true,
  "assessment_returned" BOOLEAN NOT NULL DEFAULT true,
  "assessment_acknowledged" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Foreign keys (guarded for re-runs)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'notifications_assessment_id_fkey'
  ) THEN
    ALTER TABLE "notifications"
      ADD CONSTRAINT "notifications_assessment_id_fkey"
      FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'notifications_user_id_fkey'
  ) THEN
    ALTER TABLE "notifications"
      ADD CONSTRAINT "notifications_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'notification_preferences_user_id_fkey'
  ) THEN
    ALTER TABLE "notification_preferences"
      ADD CONSTRAINT "notification_preferences_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS "notifications_assessment_id_idx" ON "notifications"("assessment_id");
CREATE INDEX IF NOT EXISTS "notifications_user_id_idx" ON "notifications"("user_id");
CREATE INDEX IF NOT EXISTS "notifications_status_idx" ON "notifications"("status");
CREATE INDEX IF NOT EXISTS "notification_preferences_user_id_idx" ON "notification_preferences"("user_id");
