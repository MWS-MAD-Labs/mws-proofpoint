# Observation acknowledgement automation

Apply the Prisma migration before enabling the scheduler:

```sh
npm run db:migrate:deploy
```

The job endpoint is:

```text
POST /api/cron/observation-acknowledgements
Authorization: Bearer <CRON_SECRET>
```

The Docker Compose deployment includes an hourly scheduler container. For another platform, configure an hourly scheduled request to the same endpoint. Running more frequently is safe because reminder periods are protected by a database unique constraint and automatic acknowledgement is a conditional update.

Reminder delivery uses short database operations and sends SMTP outside transactions, so a slow mail provider does not block acknowledgement or reopen actions. Failed reminders can be reclaimed on the next run, and claims left in `processing` for more than one hour are recoverable. A state check is performed immediately before delivery; because SMTP is intentionally outside the database transaction, an acknowledgement occurring after that check may very rarely cross with an already-started reminder delivery.

Environment settings:

- `CRON_SECRET`: required secret for the scheduler endpoint.
- `OBSERVATION_ACK_FIRST_REMINDER_DAYS`: first reminder delay; default `3`.
- `OBSERVATION_ACK_REMINDER_INTERVAL_DAYS`: repeat reminder interval; default `2`.
- `OBSERVATION_AUTO_ACK_DAYS`: automatic acknowledgement deadline; default `30`.

Only observations submitted after the migration is deployed are enrolled automatically. Existing pending observations retain their current state unless they are reopened and submitted again. This avoids unexpected changes to historical records.
