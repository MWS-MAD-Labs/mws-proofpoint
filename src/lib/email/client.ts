import nodemailer from 'nodemailer';
import { emailConfig } from './config';
import type { EmailProvider } from './types';

export function createEmailClient() {
  const service = emailConfig.service as EmailProvider;

  switch (service) {
    case 'nodemailer':
      return nodemailer.createTransport({
        host: emailConfig.smtp.host,
        port: emailConfig.smtp.port,
        secure: emailConfig.smtp.secure,
        auth: {
          user: emailConfig.smtp.user,
          pass: emailConfig.smtp.password,
        },
      });

    case 'resend':
      throw new Error('Resend not implemented yet');

    default:
      throw new Error(`Unsupported email provider: ${service}`);
  }
}

function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validateAndNormalizeEmails(to: string | string[]): string[] {
  const emails = Array.isArray(to) ? to : [to];
  const validEmails = emails.filter(isValidEmail);
  return validEmails;
}

export async function sendEmail(params: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!emailConfig.enabled) {
    console.log('[Email] Email disabled, skipping send');
    return { success: true };
  }

  const validEmails = validateAndNormalizeEmails(params.to);
  if (validEmails.length === 0) {
    console.error('[Email] No valid email addresses provided');
    return {
      success: false,
      error: 'No valid email addresses provided',
    };
  }

  try {
    const transporter = createEmailClient();

    const info = await transporter.sendMail({
      from: `${emailConfig.from.name} <${emailConfig.from.email}>`,
      to: validEmails.join(', '),
      subject: params.subject,
      html: params.html,
      text: params.text,
    });

    if (emailConfig.debug) {
      console.log('[Email] Sent:', info.messageId);
    }

    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[Email] Send failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
