import { query, queryOne } from "@/lib/db";
import type { NotificationType } from "./types";

export async function createNotificationLog(params: {
  assessmentId: string;
  userId: string;
  type: NotificationType;
}): Promise<number> {
  const result = await queryOne<{ id: number }>(
    `INSERT INTO notifications (assessment_id, user_id, type, status)
     VALUES ($1, $2, $3, 'pending')
     RETURNING id`,
    [params.assessmentId, params.userId, params.type],
  );

  if (!result) {
    throw new Error("Failed to create notification log");
  }

  return result.id;
}

export async function deleteNotificationLog(
  notificationId: number,
): Promise<void> {
  await query("DELETE FROM notifications WHERE id = $1", [notificationId]);
}

export async function markNotificationSent(
  notificationId: number,
): Promise<void> {
  await query(
    `UPDATE notifications
     SET status = 'sent', sent_at = now()
     WHERE id = $1`,
    [notificationId],
  );
}

export async function markNotificationFailed(
  notificationId: number,
  error: string | undefined,
): Promise<void> {
  await query(
    `UPDATE notifications
     SET status = 'failed', error = $1
     WHERE id = $2`,
    [error || "Unknown error", notificationId],
  );
}

export async function getPendingNotificationCount(): Promise<number> {
  const result = await queryOne<{ count: bigint }>(
    "SELECT COUNT(*) as count FROM notifications WHERE status = $1",
    ["pending"],
  );
  return Number(result?.count || 0);
}

export async function getFailedNotifications(limit = 50) {
  return query(
    `SELECT n.*, a.period, sp.full_name as staff_name
     FROM notifications n
     LEFT JOIN assessments a ON n.assessment_id = a.id
     LEFT JOIN profiles sp ON a.staff_id = sp.user_id
     WHERE n.status = 'failed'
     ORDER BY n.created_at DESC
     LIMIT $1`,
    [limit],
  );
}
