# Production-to-Staging Database Refresh

## Purpose

Use this runbook when ProofPoint staging must be replaced with an exact logical snapshot of the production PostgreSQL database on the Komodo host.

This procedure is destructive to the current staging database. Production remains read-only throughout the operation.

## Current Komodo mapping

| Environment | Compose project | Application container | PostgreSQL container | Database |
| --- | --- | --- | --- | --- |
| Production | `proofpoint` | `proofpoint-app` | `proofpoint-db` | `proofpoint` |
| Staging | `proofpoint-staging` | `proofpoint-app-stg` | `proofpoint-db-stg` | `proofpoint_stg` |

Do not assume these names permanently. Confirm them with `docker compose ls` and `docker ps` before every refresh.

## Safety requirements

- Use a PostgreSQL client version equal to or newer than the server version.
- Never print or copy database passwords from container environments.
- Do not stop or modify the production application or database.
- Create both a production source dump and a staging rollback dump before replacing staging.
- Store dumps only in a protected server-side backup directory and never commit them.
- Stop the staging application during database replacement so it cannot create sessions or run background jobs.
- Use `--no-owner --no-privileges` so production ownership is not copied into staging.

## Procedure

### 1. Inventory and preflight

```sh
ssh komodo

docker compose ls
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'

docker exec proofpoint-db pg_isready
docker exec proofpoint-db-stg pg_isready
```

Confirm the database name and user without displaying secret values:

```sh
docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' proofpoint-db \
  | grep -E '^POSTGRES_(USER|DB)='

docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' proofpoint-db-stg \
  | grep -E '^POSTGRES_(USER|DB)='
```

Record table and migration counts and confirm there are no unexpected active sessions:

```sql
SELECT
  current_database(),
  pg_size_pretty(pg_database_size(current_database())),
  (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'),
  (SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL);

SELECT count(*)
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid <> pg_backend_pid();
```

### 2. Create source and rollback dumps

Use a UTC timestamp in every filename:

```sh
mkdir -p /var/backups/proofpoint

# Replace TIMESTAMP with a literal UTC timestamp such as 20260827T023550Z.
docker exec proofpoint-db \
  pg_dump -U proofpoint -d proofpoint \
  --format=custom --compress=9 --no-owner --no-privileges \
  > /var/backups/proofpoint/production-TIMESTAMP.dump

docker exec proofpoint-db-stg \
  pg_dump -U proofpoint_stg -d proofpoint_stg \
  --format=custom --compress=9 --no-owner --no-privileges \
  > /var/backups/proofpoint/staging-before-prod-sync-TIMESTAMP.dump

sha256sum \
  /var/backups/proofpoint/production-TIMESTAMP.dump \
  /var/backups/proofpoint/staging-before-prod-sync-TIMESTAMP.dump
```

Keep the staging backup until the refresh is accepted.

### 3. Replace staging

```sh
docker stop proofpoint-app-stg

docker exec proofpoint-db-stg \
  dropdb --force -U proofpoint_stg proofpoint_stg

docker exec proofpoint-db-stg \
  createdb -U proofpoint_stg -O proofpoint_stg proofpoint_stg

docker exec -i proofpoint-db-stg \
  pg_restore -U proofpoint_stg -d proofpoint_stg \
  --exit-on-error --no-owner --no-privileges \
  < /var/backups/proofpoint/production-TIMESTAMP.dump

docker start proofpoint-app-stg
```

### 4. Verify application startup

```sh
docker inspect proofpoint-app-stg \
  --format 'state={{.State.Status}} restart-count={{.RestartCount}} started={{.State.StartedAt}}'

docker logs --tail 80 proofpoint-app-stg
curl --fail --silent --show-error --output /dev/null \
  --write-out 'staging-http=%{http_code}\n' \
  http://127.0.0.1:3160/
```

The application must be running without restart loops, migrations must complete, and the local staging HTTP response must be successful.

### 5. Verify database parity

At minimum compare:

- public table count;
- successfully applied migration count;
- row counts for all business tables;
- normalized schema dumps;
- normalized data dumps.

Raw plain-text dump hashes differ because PostgreSQL generates random `\\restrict` and `\\unrestrict` tokens. Remove only those generated lines before comparing hashes.

The staging application runs the observation acknowledgement scheduler. Its singleton runtime status row may update after startup. If an exact point-in-time logical comparison is required, copy `observation_acknowledgement_scheduler_status` from production after staging starts, compare immediately, and expect the row to diverge later as each environment runs independently.

Example normalized data comparison:

```sh
docker exec proofpoint-db \
  pg_dump -U proofpoint -d proofpoint \
  --no-owner --no-privileges --data-only --inserts \
  | grep -v '^\\restrict ' \
  | grep -v '^\\unrestrict ' \
  > /var/backups/proofpoint/verify-prod-data-normalized.sql

docker exec proofpoint-db-stg \
  pg_dump -U proofpoint_stg -d proofpoint_stg \
  --no-owner --no-privileges --data-only --inserts \
  | grep -v '^\\restrict ' \
  | grep -v '^\\unrestrict ' \
  > /var/backups/proofpoint/verify-stg-data-normalized.sql

sha256sum \
  /var/backups/proofpoint/verify-prod-data-normalized.sql \
  /var/backups/proofpoint/verify-stg-data-normalized.sql

cmp \
  /var/backups/proofpoint/verify-prod-data-normalized.sql \
  /var/backups/proofpoint/verify-stg-data-normalized.sql
```

Warnings about the self-referencing `departments` table are expected for data-only dumps used for comparison. Use the custom full dump for restoration.

## Rollback

If staging validation fails:

1. Stop `proofpoint-app-stg`.
2. Drop and recreate `proofpoint_stg` with owner `proofpoint_stg`.
3. Restore `staging-before-prod-sync-TIMESTAMP.dump` with `--exit-on-error --no-owner --no-privileges`.
4. Restart `proofpoint-app-stg`.
5. Verify migrations, logs, HTTP status, and critical row counts.
6. Retain both dumps and failure logs until the incident is resolved.
