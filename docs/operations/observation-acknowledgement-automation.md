# Observation acknowledgement automation

Apply the Prisma migration before enabling the scheduler:

```sh
npm run db:migrate:deploy
```

## Scheduler lifecycle

The scheduler runs inside the long-lived Next.js Node process. Next.js calls `src/instrumentation.ts` when the server starts, which starts the observation acknowledgement scheduler after a short initial delay and repeats it hourly by default.

No separate cron container or HTTP scheduler endpoint is required. PostgreSQL advisory locking ensures that only one application replica processes a scheduler cycle when multiple replicas are running. A replica that cannot acquire the lock skips that cycle.

The processor calculates eligibility from persisted submission timestamps, so missing a cycle while the application is restarting does not change the 3-day, 2-day, or 30-day rules. Processing resumes after the next application startup. If every application replica is stopped, no reminders or automatic acknowledgements are processed until an instance is running again.

## Delivery and concurrency behavior

Reminder delivery uses short database operations and sends SMTP outside transactions, so a slow mail provider does not block acknowledgement or reopen actions. Failed reminders can be reclaimed on the next run, and claims left in `processing` for more than one hour are recoverable.

A state check is performed immediately before delivery. Because SMTP is intentionally outside the database transaction, an acknowledgement occurring after that check may very rarely cross with an already-started reminder delivery. Reminder-period uniqueness still prevents duplicate delivery by concurrent scheduler runs.

Automatic acknowledgement uses a conditional database update requiring the observation to remain submitted and unacknowledged for the same submission cycle. Personal acknowledgement can replace an automatic acknowledgement and is preserved as the final acknowledgement method.

## Environment settings

- `OBSERVATION_ACK_SCHEDULER_ENABLED`: enables the in-app scheduler; default `true`. Set to `false` for processes that should not schedule background work.
- `OBSERVATION_ACK_SCHEDULER_INTERVAL_MINUTES`: interval between scheduler runs; default `60`.
- `OBSERVATION_ACK_SCHEDULER_INITIAL_DELAY_SECONDS`: delay after application startup before the first run; default `30`.
- `OBSERVATION_ACK_FIRST_REMINDER_DAYS`: first reminder delay; default `3`.
- `OBSERVATION_ACK_REMINDER_INTERVAL_DAYS`: repeat reminder interval; default `2`.
- `OBSERVATION_AUTO_ACK_DAYS`: automatic acknowledgement deadline; default `30`.

Only observations submitted after the migration is deployed are enrolled automatically. Existing pending observations retain their current state unless they are reopened and submitted again. This avoids unexpected changes to historical records.

## Operational checks

Application logs use the `[Observation scheduler]` prefix. After deployment, confirm that logs show the scheduler starting and a completed or advisory-lock-skipped run. For multi-replica deployments, seeing skipped runs on secondary replicas is expected.
