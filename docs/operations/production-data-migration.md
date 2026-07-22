# Production Database Migration Runbook

## Scope

This runbook prepares the ProofPoint `Staging` code for promotion to production while keeping personal and operational data out of Git.

Production data migration is intentionally manual and must be performed directly on the Komodo server after the production code/schema deployment is approved.

## Data handling rules

- Never commit database dumps, user rosters, emails, profile exports, assessment data, observation answers, notes, evidence, or notification records.
- Store local exports only under `backups/`. The directory and common dump/tabular formats are ignored by Git.
- Treat the full and data-only staging archives as sensitive. They contain password hashes, emails, profiles, assessment content, observation answers, notes, and audit history.
- Do not send dump files through chat, issue trackers, or pull requests.
- Keep at least one production pre-migration backup until the migration has been accepted.

## Credential cleanup required before production promotion

The repository previously tracked `.env`. The file has now been removed from the Git index and remains available only in the local ignored workspace, but its historical values remain in existing Git commits.

Before production promotion:

1. Rotate the PostgreSQL password and update `DATABASE_URL`/`POSTGRES_PASSWORD` in Komodo.
2. Rotate `NEXTAUTH_SECRET`; expect existing login sessions to become invalid.
3. Rotate both the MinIO access key and secret key, updating the application and MinIO deployment together.
4. Revoke and replace the exposed SMTP/Gmail application password, then update `SMTP_USER`/`SMTP_PASSWORD` in Komodo if the sender account changes.
5. Verify no deployment depends on the old values.
6. Decide whether repository history must be rewritten using an approved secret-removal process. Coordinate this because rewriting shared history requires every clone and open branch to be refreshed.

Do not paste replacement credentials into this repository. Store them only in Komodo/environment secret configuration.

## Verified source state

Source: Komodo stack `proofpoint-staging`, captured after the employee roster reconciliation on 2026-07-22.

| Table/state | Expected rows |
|---|---:|
| departments | 13 |
| users | 74 |
| active users | 74 |
| suspended users | 0 |
| profiles | 74 |
| user roles | 80 |
| assessments | 7 |
| assessment questions | 0 |
| observations | 91 |
| observation answers | 8,531 |
| observation updates | 140 |
| notifications | 10 |
| notification preferences | 8 |
| rubric templates | 21 |
| rubric indicators | 302 |
| department role memberships | 79 |

The reconciled roster contains 106 current employees. Of those, 55 matched existing ProofPoint accounts. Another 19 legacy ProofPoint accounts were retained and restored to active status, resulting in 74 active accounts and no suspended accounts. The remaining 51 roster employees must not be created until authoritative email addresses are supplied.

Nickname and job-level fields are intentionally not migrated because ProofPoint does not store them.

## Local sensitive artifacts

The following files are local-only and ignored by Git:

- `backups/proofpoint-staging-post-reactivation-full-20260722.dump`
- `backups/proofpoint-staging-post-reactivation-data-20260722.dump`
- `backups/proofpoint-staging-post-reactivation-20260722.sha256`
- `backups/proofpoint-staging-post-reactivation-inventory-20260722.txt`
- `backups/staging-user-roster-2026-07-21.tsv`
- `backups/staging-user-roster-missing-accounts-20260721.tsv`

The full archive is the preferred source because the data-only archive reports a circular foreign-key warning for the self-referencing `departments` table. If a data-only restore is used, restore with triggers disabled and validate constraints afterward.

## Current production compatibility warning

At preparation time, production had only 17 tables and migrations through `20260225000000_fix_id_defaults`, while staging had 37 tables and migrations through `20260721000003_department_role_memberships`.

Therefore:

1. Deploy the production code and run all Prisma migrations first.
2. Confirm the production schema matches the staging schema.
3. Only then migrate application data.

Never restore current staging data into the legacy production schema.

## Recommended migration sequence

### 1. Schedule downtime

Stop writes to production. Prefer stopping the application container while leaving PostgreSQL available for backup and restore.

### 2. Back up production

Create a custom-format production backup before any schema or data change:

```sh
pg_dump -Fc --no-owner --no-acl -d "$DATABASE_URL" -f /secure/path/proofpoint-production-pre-migration.dump
sha256sum /secure/path/proofpoint-production-pre-migration.dump
```

Test that the archive can be listed with the same or newer PostgreSQL client:

```sh
pg_restore --list /secure/path/proofpoint-production-pre-migration.dump >/dev/null
```

### 3. Deploy code and schema

Deploy the approved `mws/Staging` revision to the production image/tag, then run:

```sh
npm run db:migrate:deploy
```

Confirm all migrations are finished:

```sql
SELECT migration_name, finished_at, rolled_back_at
FROM _prisma_migrations
ORDER BY started_at;
```

There must be no unfinished, non-rolled-back migration.

### 4. Verify the empty/new schema shape

Run the repository verifier before restoring data:

```sh
psql "$DATABASE_URL" -f scripts/verify-production-data-migration.sql
```

Counts may differ at this stage, but the script must complete without missing-table or integrity errors.

### 5. Restore data manually

Use one of these controlled approaches.

#### Preferred for a complete staging replacement

Restore the full staging archive into a newly created empty production database, then switch the application connection after validation. This is safer than deleting data in place and provides a quick connection-string rollback.

```sh
createdb proofpoint_next
pg_restore \
  --exit-on-error \
  --no-owner \
  --no-acl \
  --dbname=proofpoint_next \
  /secure/path/proofpoint-staging-post-reactivation-full-20260722.dump
```

Do not include staging's `_prisma_migrations` records if production migrations have already initialized the target database; either restore into a completely empty database or exclude/replace `_prisma_migrations` deliberately.

#### If production data must be retained

Do not perform a blanket restore. Use a reviewed table-by-table merge keyed by stable UUIDs and email addresses. At minimum, reconcile these dependency groups in order:

1. `departments`
2. rubric/workflow definitions and indicators
3. `users`, `profiles`, and `user_roles`
4. department-role memberships and assignments
5. assessments and questions
6. observations, answers, and updates
7. notifications and preferences

This path requires a production-specific SQL plan after comparing both databases. Avoid `--clean`, `DROP DATABASE`, or unconditional `TRUNCATE ... CASCADE` on the current production database.

### 6. Validate migrated data

Run:

```sh
psql "$DATABASE_URL" -f scripts/verify-production-data-migration.sql
```

For a complete staging replacement, compare the output with the expected counts in this document. Also verify:

- 74 active and 0 suspended users.
- Every active profile has a department and job title.
- `SHIELD` exists exactly once.
- The 51 employees without authoritative emails have not been invented as accounts.
- Observation pages load for managers and staff.
- Submitted/acknowledged observation statuses and update history are preserved.
- Existing admin access remains available.

### 7. Smoke test

Use non-destructive checks:

- Sign in as an administrator.
- Open user management and confirm active/suspended filtering.
- Open several observations covering draft, submitted, and acknowledged states.
- Confirm rubric indicators and answer counts display correctly.
- Confirm no unexpected email notifications are sent during the restore.

### 8. Re-enable production

Start the production application only after validation succeeds. Monitor application logs and database errors during the first login and observation workflows.

## Rollback

If validation fails:

1. Stop the application.
2. If using a new database, point the application back to the original production database.
3. Otherwise restore the pre-migration production archive into a clean database.
4. Start the previous production image.
5. Preserve failed-migration logs and do not delete either backup until the incident is resolved.

## Branch promotion note

Use `mws/main` as the production base. The local `main` branch tracks a different remote and has no merge base with `Staging`.

At preparation time, `mws/Staging` and `mws/main` share base commit `cd7055e`, with substantial schema and application changes on `mws/Staging`. Review the pull request and CI results before merge; do not merge database dumps or local `backups/` artifacts.
