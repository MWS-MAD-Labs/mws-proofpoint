import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function seedNotificationPreferences() {
  const result = await pool.query(
    `SELECT id FROM users WHERE status = 'active'`
  );

  console.log(`Creating notification preferences for ${result.rows.length} users...`);

  for (const row of result.rows) {
    await pool.query(
      `INSERT INTO notification_preferences (user_id, email_enabled, assessment_submitted, manager_review_done, director_approved, admin_released, assessment_returned, assessment_acknowledged)
       VALUES ($1, true, true, true, true, true, true, true)
       ON CONFLICT (user_id) DO NOTHING`,
      [row.id]
    );
  }

  console.log('Notification preferences seeded successfully.');
  await pool.end();
  process.exit(0);
}

seedNotificationPreferences().catch((e) => {
  console.error(e);
  process.exit(1);
});
