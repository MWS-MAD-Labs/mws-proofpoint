# Prisma migration history rebaseline

## Purpose

ProofPoint's deployed PostgreSQL databases contain a valid schema, but the old repository migration directory was not reproducible:

- four applied migration files were no longer recoverable from available Git refs;
- the applied `20260301000000_strategic_planning` checksum matched an older Git revision rather than the file that remained in the repository;
- an empty PostgreSQL database could not apply the old chain because an available historical migration referenced UUID foreign keys before the identifier conversion was present.

The active history was therefore replaced with a verified schema baseline:

```text
20260812000000_existing_database_baseline
20260824000000_observation_acknowledgement_automation
20260826000000_observation_notification_settings
20260827000000_observation_scheduler_observability
```

The former files are retained under `prisma/migration-history-archive/pre-20260812-baseline` for audit context and are not executed by Prisma.

## Safety properties

The rebaseline command changes only `_prisma_migrations` metadata. It does not drop or alter application tables, business data, users, assessments, observations, or evidence.

The command refuses to run unless:

- `DATABASE_URL` is configured;
- the explicit confirmation value is present;
- `_prisma_migrations` exists;
- there are no unresolved failed migrations;
- required baseline tables exist;
- core identifiers use UUIDs, matching the verified baseline.

It preserves already-applied forward migration records for `20260824000000_observation_acknowledgement_automation`, `20260826000000_observation_notification_settings`, and `20260827000000_observation_scheduler_observability`.

## Required rollout sequence

Perform this once for every existing environment before deploying an image whose active migrations start at the new baseline.

### 1. Schedule a maintenance window

Stop application writes. Prefer stopping the application container while leaving PostgreSQL available.

### 2. Back up and verify PostgreSQL

```sh
pg_dump -Fc --no-owner --no-acl -d "$DATABASE_URL" -f /secure/path/proofpoint-pre-rebaseline.dump
pg_restore --list /secure/path/proofpoint-pre-rebaseline.dump >/dev/null
```

Keep this backup until staging and production validation is complete.

### 3. Capture existing migration records

```sql
SELECT migration_name, checksum, finished_at, rolled_back_at
FROM _prisma_migrations
ORDER BY started_at, migration_name;
```

Store this output with the private deployment record, not in Git if it includes environment-sensitive metadata.

### 4. Run the guarded rebaseline command

From the release source containing the new baseline:

```sh
MIGRATION_HISTORY_REBASE_CONFIRM=rebaseline-20260812000000_existing_database_baseline \
  npm run db:migrate:rebaseline
```

Expected output reports the number of superseded historical records, any preserved forward migrations, and the baseline checksum.

### 5. Apply forward migrations

```sh
npm run db:migrate:deploy
```

If the acknowledgement migrations were already applied, Prisma reports no pending migrations. Otherwise it applies them in order.

### 6. Verify migration status

```sh
npm run db:migrate:status
```

Expected result:

```text
Database schema is up to date!
```

Verify the active records:

```sql
SELECT migration_name, finished_at, rolled_back_at
FROM _prisma_migrations
ORDER BY started_at, migration_name;
```

Only the baseline and applicable forward migrations should remain.

### 7. Validate the application

- Start the application and verify container health.
- Confirm public pages return `200`.
- Confirm protected APIs return `401` when unauthenticated.
- Verify existing users, assessments, observations, and evidence remain available.
- Open `/admin/notification-settings` as an administrator.
- Verify scheduler startup and migration logs contain no errors.

## Fresh database verification

A new PostgreSQL 16 database must be able to run:

```sh
npm run db:migrate:deploy
npm run db:migrate:status
npm run db:migrate:check
```

No manual resolve or rebaseline command is needed for a new database.

## Prisma datamodel compatibility

`prisma/schema.prisma` has been reconciled with the verified deployed PostgreSQL schema, including UUID native types, legacy migration fields, timestamp types, relation actions, index names, partial indexes, and audit tables.

Verify continued alignment before every schema release:

```sh
npx prisma migrate diff \
  --exit-code \
  --from-config-datasource \
  --to-schema prisma/schema.prisma
```

The expected result is `No difference detected.` Check constraints, trigger functions, and PostgreSQL extensions remain database-managed objects in the baseline SQL because Prisma Client does not model them directly.

Production and shared environments must still use `prisma migrate deploy`, never `prisma db push`.

## Rollback

If the rebaseline command fails before commit, its transaction rolls back automatically.

If validation fails after a successful rebaseline:

1. Stop application writes.
2. Restore the verified pre-rebaseline PostgreSQL backup.
3. Redeploy the previous application image.
4. Investigate using a database clone before retrying.

Do not reconstruct old `_prisma_migrations` rows manually from memory.
