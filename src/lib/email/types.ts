export type EmailProvider = 'nodemailer' | 'resend' | 'sendgrid' | 'ses';

export interface EmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface AssessmentEmailData {
  assessmentId: string;
  staffName: string;
  period: string;
  templateName?: string;
  score?: string;
  grade?: string;
  notes?: string;
  actionUrl: string;
}
