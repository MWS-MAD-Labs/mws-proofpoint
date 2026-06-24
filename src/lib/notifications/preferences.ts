import { query, queryOne } from '@/lib/db';
import type { NotificationType } from './types';

export interface UserNotificationPreference {
  userId: string;
  emailEnabled: boolean;
  assessmentSubmitted: boolean;
  managerReviewDone: boolean;
  directorApproved: boolean;
  adminReleased: boolean;
  assessmentReturned: boolean;
  assessmentAcknowledged: boolean;
}

type PreferenceKey = keyof Omit<UserNotificationPreference, 'userId'>;

const COLUMN_MAP: Record<PreferenceKey, string> = {
  emailEnabled: 'email_enabled',
  assessmentSubmitted: 'assessment_submitted',
  managerReviewDone: 'manager_review_done',
  directorApproved: 'director_approved',
  adminReleased: 'admin_released',
  assessmentReturned: 'assessment_returned',
  assessmentAcknowledged: 'assessment_acknowledged',
};

const DEFAULT_PREFERENCES: Omit<UserNotificationPreference, 'userId'> = {
  emailEnabled: true,
  assessmentSubmitted: true,
  managerReviewDone: true,
  directorApproved: true,
  adminReleased: true,
  assessmentReturned: true,
  assessmentAcknowledged: true,
};

export async function getUserNotificationPreference(
  userId: string,
): Promise<UserNotificationPreference> {
  const pref = await queryOne<UserNotificationPreference>(
    `SELECT
      user_id AS "userId",
      COALESCE(email_enabled, true) AS "emailEnabled",
      COALESCE(assessment_submitted, true) AS "assessmentSubmitted",
      COALESCE(manager_review_done, true) AS "managerReviewDone",
      COALESCE(director_approved, true) AS "directorApproved",
      COALESCE(admin_released, true) AS "adminReleased",
      COALESCE(assessment_returned, true) AS "assessmentReturned",
      COALESCE(assessment_acknowledged, true) AS "assessmentAcknowledged"
     FROM notification_preferences
     WHERE user_id = $1`,
    [userId],
  );

  if (!pref) {
    return { userId, ...DEFAULT_PREFERENCES };
  }

  return pref;
}

export async function isNotificationEnabled(
  userId: string,
  type: NotificationType,
): Promise<boolean> {
  const pref = await getUserNotificationPreference(userId);

  if (!pref.emailEnabled) {
    return false;
  }

  const typeColumns: Record<NotificationType, PreferenceKey> = {
    assessment_submitted: 'assessmentSubmitted',
    manager_review_completed: 'managerReviewDone',
    director_approved: 'directorApproved',
    admin_released: 'adminReleased',
    assessment_returned: 'assessmentReturned',
    assessment_acknowledged: 'assessmentAcknowledged',
  };

  const column = typeColumns[type];
  return pref[column] === true;
}

export async function updateUserNotificationPreference(
  userId: string,
  preferences: Partial<Omit<UserNotificationPreference, 'userId'>>,
): Promise<void> {
  const updates = Object.entries(preferences).filter(
    (entry): entry is [PreferenceKey, boolean] => {
      const [key, value] = entry as [PreferenceKey, unknown];
      return key in COLUMN_MAP && typeof value === 'boolean';
    },
  );

  if (updates.length === 0) {
    return;
  }

  const columns = ['user_id', ...updates.map(([key]) => COLUMN_MAP[key])];
  const placeholders = columns.map((_, index) => `$${index + 1}`);
  const values: Array<string | boolean> = [userId, ...updates.map(([, value]) => value)];
  const setClauses = updates.map(
    ([key]) => `${COLUMN_MAP[key]} = EXCLUDED.${COLUMN_MAP[key]}`,
  );

  setClauses.push('updated_at = now()');

  await query(
    `INSERT INTO notification_preferences (${columns.join(', ')})
     VALUES (${placeholders.join(', ')})
     ON CONFLICT (user_id) DO UPDATE
     SET ${setClauses.join(', ')}`,
    values,
  );
}
