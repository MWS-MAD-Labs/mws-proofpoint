import { sendEmail, emailSubjects, emailTemplates } from "@/lib/email";
import { query } from "@/lib/db";
import { isNotificationEnabled } from "./preferences";
import { getAssessmentNotificationData } from "./fetcher";
import {
  createNotificationLog,
  markNotificationSent,
  markNotificationFailed,
  deleteNotificationLog,
} from "./logger";
import type { NotificationTriggerParams, NotificationType } from "./types";

const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

async function getAdminUsers(): Promise<
  Array<{ userId: string; email: string; name: string }>
> {
  const admins = await query<{
    user_id: string;
    email: string;
    full_name: string | null;
  }>(
    `SELECT u.id as user_id, u.email, p.full_name
     FROM users u
     INNER JOIN user_roles ur ON u.id = ur.user_id
     LEFT JOIN profiles p ON u.id = p.user_id
     WHERE ur.role = 'admin' AND u.status = 'active'`,
  );
  return admins.map((a) => ({
    userId: a.user_id,
    email: a.email,
    name: a.full_name || "Admin",
  }));
}

export async function triggerNotification(
  params: NotificationTriggerParams,
): Promise<void> {
  const { assessmentId, type } = params;

  const data = await getAssessmentNotificationData(assessmentId);
  if (!data) {
    console.error("[Notification] Assessment not found:", assessmentId);
    return;
  }

  const recipients = await getRecipientsForNotificationType(type, data);

  for (const recipient of recipients) {
    await sendNotificationToRecipient({
      assessmentId,
      userId: recipient.userId,
      email: recipient.email,
      type,
      data,
      recipientName: recipient.name,
      returnedBy: type === "assessment_returned" ? data.returnedBy : undefined,
    });
  }
}

interface SendNotificationParams {
  assessmentId: string;
  userId: string;
  email: string;
  type: NotificationType;
  data: NonNullable<Awaited<ReturnType<typeof getAssessmentNotificationData>>>;
  recipientName: string;
  returnedBy?: string;
}

async function sendNotificationToRecipient(
  params: SendNotificationParams,
): Promise<{ success: boolean; error?: string }> {
  const { assessmentId, userId, email, type, data, recipientName, returnedBy } =
    params;

  if (!data) return { success: false, error: "No assessment data" };

  const enabled = await isNotificationEnabled(userId, type);
  if (!enabled) {
    console.log(`[Notification] Disabled for user ${userId}, type ${type}`);
    return { success: true };
  }

  const { html, subject } = generateEmailContent(
    type,
    data,
    recipientName,
    returnedBy,
  );

  const result = await sendEmail({
    to: email,
    subject,
    html,
  });

  let notificationId: number | null = null;

  try {
    if (result.success) {
      notificationId = await createNotificationLog({
        assessmentId,
        userId,
        type,
      });
      await markNotificationSent(notificationId);
      console.log(`[Notification] Sent ${type} to ${email}`);
      return { success: true };
    } else {
      notificationId = await createNotificationLog({
        assessmentId,
        userId,
        type,
      });
      await markNotificationFailed(notificationId, result.error);
      console.error(`[Notification] Failed ${type} to ${email}:`, result.error);
      return { success: false, error: result.error };
    }
  } catch (dbError) {
    if (notificationId) {
      await deleteNotificationLog(notificationId);
    }
    console.error(`[Notification] Database error during ${type}:`, dbError);
    return {
      success: false,
      error: dbError instanceof Error ? dbError.message : "Database error",
    };
  }
}

async function getRecipientsForNotificationType(
  type: NotificationType,
  data: NonNullable<Awaited<ReturnType<typeof getAssessmentNotificationData>>>,
): Promise<Array<{ userId: string; email: string; name: string }>> {
  switch (type) {
    case "assessment_submitted":
      return data.managerId && data.managerEmail
        ? [
            {
              userId: data.managerId,
              email: data.managerEmail,
              name: data.managerName || "Manager",
            },
          ]
        : [];

    case "manager_review_completed":
      return data.directorId && data.directorEmail
        ? [
            {
              userId: data.directorId,
              email: data.directorEmail,
              name: data.directorName || "Director",
            },
          ]
        : [];

    case "director_approved":
      return await getAdminUsers();

    case "admin_released":
    case "assessment_returned":
      if (!data.staffEmail) {
        console.error(
          "[Notification] Staff email missing for assessment:",
          data.assessmentId,
        );
        return [];
      }
      return [
        { userId: data.staffId, email: data.staffEmail, name: data.staffName },
      ];

    case "assessment_acknowledged":
      const recipients: Array<{ userId: string; email: string; name: string }> =
        [];
      if (data.managerId && data.managerEmail) {
        recipients.push({
          userId: data.managerId,
          email: data.managerEmail,
          name: data.managerName || "Manager",
        });
      }
      if (data.directorId && data.directorEmail) {
        recipients.push({
          userId: data.directorId,
          email: data.directorEmail,
          name: data.directorName || "Director",
        });
      }
      return recipients;

    default:
      return [];
  }
}

function generateEmailContent(
  type: NotificationType,
  data: NonNullable<Awaited<ReturnType<typeof getAssessmentNotificationData>>>,
  recipientName?: string,
  returnedBy?: string,
): { subject: string; html: string } {
  const baseData = {
    assessmentId: data.assessmentId,
    staffName: data.staffName,
    period: data.period,
    templateName: data.templateName,
    score: data.score,
    grade: data.grade,
    notes: data.notes,
    actionUrl: `${baseUrl}/assessment?id=${data.assessmentId}`,
  };

  switch (type) {
    case "assessment_submitted":
      return {
        subject: emailSubjects.assessmentSubmitted(data.staffName),
        html: emailTemplates.assessmentSubmitted({
          ...baseData,
          managerName: data.managerName || "Manager",
        }),
      };

    case "manager_review_completed":
      return {
        subject: emailSubjects.managerReviewCompleted(data.staffName),
        html: emailTemplates.managerReviewCompleted({
          ...baseData,
          directorName: data.directorName || "Director",
          managerName: data.managerName || "Manager",
        }),
      };

    case "director_approved":
      return {
        subject: emailSubjects.directorApproved(data.staffName),
        html: emailTemplates.directorApproved(baseData),
      };

    case "admin_released":
      return {
        subject: emailSubjects.adminReleased(),
        html: emailTemplates.adminReleased(baseData),
      };

    case "assessment_returned":
      return {
        subject: emailSubjects.assessmentReturned(),
        html: emailTemplates.assessmentReturned({
          ...baseData,
          returnedBy: returnedBy || "Administrator",
          feedback: data.notes || "",
        }),
      };

    case "assessment_acknowledged":
      return {
        subject: emailSubjects.assessmentAcknowledged(data.staffName),
        html: emailTemplates.assessmentAcknowledged({
          ...baseData,
          recipientName: recipientName || "User",
        }),
      };

    default:
      return {
        subject: "ProofPoint Dashboard Notification",
        html: emailTemplates.adminReleased(baseData),
      };
  }
}
