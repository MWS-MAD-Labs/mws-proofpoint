# Archived Prisma migration history

This directory preserves the incomplete pre-baseline migration files that were previously active under `prisma/migrations`.

They are intentionally outside Prisma's active migration path because the historical chain could not reproduce the deployed database:

- several migrations recorded by deployed databases were no longer available in Git;
- `20260301000000_strategic_planning` had been modified after deployment, so its repository checksum no longer matched the database record;
- a fresh database failed because the available historical files attempted UUID foreign keys before the corresponding identifiers were converted from text.

The active migration history now starts with:

```text
prisma/migrations/20260812000000_existing_database_baseline
```

The baseline contains the schema that existed immediately before the acknowledgement-automation migration. Forward migrations remain active and ordered after it.

Do not move these archived files back into `prisma/migrations`, edit them for deployment, or run them manually. They are retained only for investigation and audit context. Existing environments must follow `docs/operations/prisma-migration-history-rebaseline.md` once before using the new active history.
