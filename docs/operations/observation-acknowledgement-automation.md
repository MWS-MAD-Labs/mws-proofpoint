# Observation acknowledgement automation

Apply the Prisma migration before relying on the scheduler or opening the administrator settings page:

```sh
npm run db:migrate:deploy
```

## Configuration ownership

Observation notification policy and acknowledgement timing are stored in the singleton PostgreSQL `observation_notification_settings` row. Administrators manage the settings from **Administration → Notification settings** (`/admin/notification-settings`). The administrator API is available at `GET` and `PUT /api/admin/observation-notification-settings` and is restricted to the `admin` role.

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

## Operational checks

Application logs use the `[Observation scheduler]` prefix. After deployment:

1. Confirm migrations completed and the singleton settings row is readable through the administrator page.
2. Review the saved global policy, especially reminder timing, automatic acknowledgement, and scheduler enablement.
3. Confirm logs show the scheduler starting after the fixed delay and a completed, disabled, failed, or advisory-lock-skipped cycle.
4. For multi-replica deployments, expect advisory-lock-skipped cycles on secondary replicas.
5. When validating timing in staging, use reduced values through the administrator page and restore the intended policy afterward.

A database read failure is logged and does not permanently stop the timer; the scheduler retries using its safe internal interval fallback. Do not use the administrator page as a manual “run now” control.
