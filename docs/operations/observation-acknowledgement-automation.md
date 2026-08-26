# Observation acknowledgement automation

Apply the Prisma migration before relying on the scheduler or opening the administrator settings page:

```sh
npm run db:migrate:deploy
```

## Configuration ownership

Observation notification policy and acknowledgement timing are stored in the singleton PostgreSQL `observation_notification_settings` row. Administrators manage the settings from **Administration → Notification settings** (`/admin/notification-settings`). The administrator API is available at `GET` and `PUT /api/admin/observation-notification-settings` and is restricted to the `admin` role. Read-only scheduler status and paginated audit history are available on the same page through admin-only status and history endpoints.

The database settings control:

- the global observation notification master switch;
- submission, reminder, personal acknowledgement, automatic acknowledgement, reopen, and reassignment email events;
- first-reminder and repeat-reminder timing;
- automatic acknowledgement enablement and deadline;
- scheduler enablement and check interval.

Changes are read by the application without a rebuild or restart. An already-running scheduler cycle uses the settings it loaded for that cycle; interval changes affect the next scheduling decision.

SMTP host, credentials, sender identity, and the infrastructure-level `EMAIL_ENABLED` switch remain deployment environment settings. They are not exposed by the administrator settings API or UI.

## Scheduler lifecycle

The scheduler runs inside the long-lived Next.js Node process. Next.js calls `src/instrumentation.ts` when the server starts. The scheduler uses a fixed internal 30-second startup delay, then reads the current database settings before processing and before choosing its next interval.

The startup delay is intentionally not configurable: it is an implementation detail rather than observation workflow policy. There are no `OBSERVATION_ACK_*` or `OBSERVATION_AUTO_ACK_DAYS` deployment settings.

No separate cron container or HTTP scheduler endpoint is required. PostgreSQL advisory locking ensures that only one application replica processes a scheduler cycle when multiple replicas are running. A replica that cannot acquire the lock skips that cycle.

The processor calculates eligibility from persisted submission timestamps and the current global timing policy. Missing a cycle while the application is restarting does not change an observation's submitted timestamp or deadline calculation. Processing resumes after the next application startup. If every application replica is stopped, no reminders or automatic acknowledgements are processed until an instance is running again.

## Mandatory workflow email policy

Observation workflow emails are controlled globally and are not suppressed by a user's appraisal email preferences. The user-facing email toggle under `/settings/notifications` controls appraisal emails only.

Disabling a specific global observation event prevents that event's email. Disabling the master observation notification switch prevents all observation workflow emails and acknowledgement automation processing. SMTP `EMAIL_ENABLED` remains the final infrastructure-level delivery switch.

## Delivery and concurrency behavior

Reminder delivery uses short database operations and sends SMTP outside transactions, so a slow mail provider does not block acknowledgement or reopen actions. Failed reminders can be reclaimed on the next run, and claims left in `processing` for more than one hour are recoverable.

A state check is performed immediately before delivery. Because SMTP is intentionally outside the database transaction, an acknowledgement occurring after that check may very rarely cross with an already-started reminder delivery. Reminder-period uniqueness still prevents duplicate delivery by concurrent scheduler runs.

Automatic acknowledgement uses a conditional database update requiring the observation to remain submitted and unacknowledged for the same submission cycle. Personal acknowledgement can replace an automatic acknowledgement and is preserved as the final acknowledgement method.

Only observations submitted after the acknowledgement automation migration was deployed are enrolled automatically. Existing pending observations retain their current state unless they are reopened and submitted again. This avoids unexpected changes to historical records.

## Scheduler observability

The administrator page shows the last attempted and successful cycles, the settings revision used, the next expected cycle, advisory-lock skip count, work counters, and the latest error summary. This status is persisted in PostgreSQL so it represents the deployment rather than only the application replica serving the page.

The checked, reminded, automatic-acknowledgement, skipped, and failed counters describe the latest authoritative scheduler outcome rather than cumulative totals. A policy-disabled cycle records one skipped cycle with the other work counters reset; a failed cycle records one failure and retains the previous last-successful timestamp. Advisory-lock skips are cumulative because they are expected across replicas and do not replace the last authoritative work outcome. The next expected cycle is an estimate based on the settings used by the recorded attempt; deployment restarts and configuration changes can shift the actual timer.

The page intentionally has no manual “run now” control. Use application logs and the persisted status for monitoring rather than remote execution.

## Operational checks

Application logs use the `[Observation scheduler]` prefix. After deployment:

1. Confirm migrations completed and the singleton settings row is readable through the administrator page.
2. Review the saved global policy, especially reminder timing, automatic acknowledgement, and scheduler enablement.
3. Confirm the scheduler status card records the settings revision and expected cycle time.
4. Confirm logs show the scheduler starting after the fixed delay and a completed, disabled, failed, or advisory-lock-skipped cycle.
5. For multi-replica deployments, expect advisory-lock-skipped cycles on secondary replicas and an increasing lock-skip count.
6. Review the paginated audit history after changing policy, especially highlighted timing-policy changes.
7. When validating timing in staging, use reduced values through the administrator page and restore the intended policy afterward.

A database read failure is logged and does not permanently stop the timer; the scheduler retries using its safe internal interval fallback. Do not use the administrator page as a manual “run now” control.

## Automated verification

Run the non-database notification-policy and route tests with:

```sh
npm run test:observations
```

Database-backed observation tests must use an isolated PostgreSQL database:

```sh
TEST_DATABASE_URL=postgresql://user:password@localhost:5432/proofpoint_test \
  npm run test:observations:integration
```

The guarded runner refuses production or staging hostnames, refuses the primary `DATABASE_URL`, and requires the database name to end in `_test`. It creates the isolated database when permitted, resets it, applies the active Prisma migrations, and then runs the observation integration suite. Never point `TEST_DATABASE_URL` at a shared development, staging, or production database.
