# Multi-teacher observations rollout

This runbook covers the additive compatibility release that introduces shared observations with multiple observed teachers.

## Release contents

The release includes migration:

```text
20260828000000_multi_teacher_observation_foundation
```

The migration:

- creates `observation_participants`;
- adds `scope_type`, `class_name`, and `subject_name` to `observations`;
- backfills exactly one participant for every existing observation from the legacy `staffId` relation;
- copies existing acknowledgement and automation values into the participant row;
- moves acknowledgement reminder ownership to participants;
- adds structured participant identity to observation audit updates;
- aborts if an existing observation or reminder cannot be resolved safely.

The application retains legacy observation-level subject and acknowledgement columns during this compatibility release. Participant rows are the source of truth for access, acknowledgement, reminders, search, reporting, and aggregate completion.

## Pre-deployment requirements

1. Confirm the target environment has completed the Prisma migration-history rebaseline when required.
2. Take a PostgreSQL backup before deployment.
3. Confirm the application image and migration files come from the same Git commit.
4. Confirm no older application version will remain running against the database after multi-teacher creation is enabled.
5. Record that rolling back below this compatibility release is unsafe after the first multi-teacher observation is created.

## Deployment

Deploy through the normal application pipeline. Container startup runs:

```sh
npm run db:migrate:deploy
```

The application must not start if migration deployment fails.

For a local or manually managed environment, apply committed migrations without resetting data:

```sh
npm run db:migrate:deploy
npm run db:migrate:status
```

Expected status:

```text
Database schema is up to date!
```

## Database verification

Run these checks after migration deployment.

### Every observation has participants

```sql
SELECT COUNT(*) AS observations_without_participants
FROM observations observation
WHERE NOT EXISTS (
  SELECT 1
  FROM observation_participants participant
  WHERE participant.observation_id = observation.id
);
```

Expected result: `0`.

### No duplicate participant membership

```sql
SELECT observation_id, staff_id, COUNT(*)
FROM observation_participants
GROUP BY observation_id, staff_id
HAVING COUNT(*) > 1;
```

Expected result: no rows.

### Reminder ownership is consistent

```sql
SELECT reminder.id
FROM observation_acknowledgement_reminders reminder
JOIN observation_participants participant
  ON participant.id = reminder.participant_id
WHERE reminder.observation_id IS NOT NULL
  AND reminder.observation_id <> participant.observation_id;
```

Expected result: no rows.

### Parent lifecycle agrees with participants

```sql
SELECT
  observation.id,
  observation.status,
  COUNT(participant.id) AS participant_count,
  COUNT(participant.id) FILTER (
    WHERE participant.acknowledged_at IS NULL
  ) AS pending_count
FROM observations observation
LEFT JOIN observation_participants participant
  ON participant.observation_id = observation.id
GROUP BY observation.id, observation.status
HAVING
  COUNT(participant.id) = 0
  OR (
    observation.status = 'acknowledged'
    AND COUNT(participant.id) FILTER (
      WHERE participant.acknowledged_at IS NULL
    ) > 0
  )
  OR (
    observation.status = 'submitted'
    AND COUNT(participant.id) > 0
    AND COUNT(participant.id) FILTER (
      WHERE participant.acknowledged_at IS NULL
    ) = 0
  );
```

Expected result: no rows.

## Staging functional verification

Verify authenticated scenarios before production promotion:

1. Create an individual observation with one teacher.
2. Create a class or subject observation with two or more teachers.
3. Confirm only forms assigned to every selected teacher are available.
4. Confirm the shared observation appears once in lists, pagination, summaries, and search.
5. Confirm every participant is hidden from draft and reopened content.
6. Submit the observation and confirm every participant receives access.
7. Acknowledge as one participant and confirm the parent remains `submitted`.
8. Confirm one participant cannot see another participant's acknowledgement response.
9. Acknowledge as the final participant and confirm the parent becomes `acknowledged` exactly once.
10. Reopen the observation and confirm all current participant acknowledgement fields reset while audit history remains.
11. Change participants while the observation is a draft and confirm the current form remains valid for all participants.
12. Confirm an observed teacher cannot be assigned as the observer and an out-of-scope manager is rejected.
13. Confirm participant reminder and automatic-acknowledgement behavior using staging notification settings.
14. Check desktop, mobile, keyboard navigation, light theme, and dark theme.

## Automated verification

Run:

```sh
npm run test:observations
npm run test:observations:integration
npm run build
```

The integration runner requires `TEST_DATABASE_URL` to reference an isolated database whose name ends in `_test`. It resets that database before applying the full active migration history.

Validation completed before the initial staging push:

- observation unit/domain/notification tests: 40 passed;
- isolated PostgreSQL observation integration tests: 10 passed;
- Prisma validation and generation passed;
- production build passed.

## Monitoring

After deployment, monitor:

- application startup and Prisma migration logs;
- multi-teacher creation validation failures;
- observations with zero participants;
- aggregate status/participant-state mismatches;
- reminder and automatic acknowledgement failures;
- notification volume and delivery errors;
- acknowledgement completion time.

Scheduler work counters represent participant processing items, not shared observation totals.

## Rollback constraints

Before any multi-teacher observation is created, application rollback remains subject to normal schema compatibility assessment.

After a multi-teacher observation is created, do not roll application code back below this compatibility release. Older code can represent only the legacy `staffId` participant and may authorize, notify, acknowledge, or display the record incorrectly.

A database rollback requires restoration from the pre-deployment backup or a separately reviewed forward migration. Prisma migrations are forward-only; do not manually delete migration-history rows or use `prisma db push` in staging or production.

Legacy observation columns will be removed only in a later cleanup release after production verification and rollback planning.
