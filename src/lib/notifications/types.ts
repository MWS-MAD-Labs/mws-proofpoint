export type NotificationType =
  | "assessment_submitted"
  | "manager_review_completed"
  | "director_approved"
  | "admin_released"
  | "assessment_returned"
  | "assessment_acknowledged";

export interface NotificationTriggerParams {
  assessmentId: string;
  type: NotificationType;
}

export interface NotificationRecipient {
  userId: string;
  email: string;
  name: string;
}

export interface AssessmentNotificationData {
  assessmentId: string;
  staffId: string;
  staffName: string;
  staffEmail: string;
  period: string;
  templateName?: string;
  score?: string;
  grade?: string;
  notes?: string;
  managerId?: string;
  managerName?: string;
  managerEmail?: string;
  directorId?: string;
  directorName?: string;
  directorEmail?: string;
  returnedBy?: string;
}
