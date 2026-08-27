-- The established database schema stores `users.status` as text and roles in
-- the lowercase PostgreSQL enum `app_role`. Keep Prisma's model mappings aligned
-- while safely migrating installations that still use the initial quoted enums.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'status'
      AND udt_name = 'UserStatus'
  ) THEN
    ALTER TABLE "users"
      ALTER COLUMN "status" DROP DEFAULT,
      ALTER COLUMN "status" TYPE TEXT USING "status"::text,
      ALTER COLUMN "status" SET DEFAULT 'active';
  END IF;
END $$;

ALTER TABLE "user_roles"
  ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'AppRole'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'app_role'
  ) THEN
    ALTER TYPE "AppRole" RENAME TO app_role;
  END IF;
END $$;
