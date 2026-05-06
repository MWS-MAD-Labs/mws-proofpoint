// src/lib/email.ts
import nodemailer from 'nodemailer';

const SMTP_HOST   = process.env.SMTP_HOST     || 'smtp.gmail.com';
const SMTP_PORT   = parseInt(process.env.SMTP_PORT || '465');
const SMTP_SECURE = process.env.SMTP_SECURE   === 'true';
const SMTP_USER   = process.env.SMTP_USER     || '';
const SMTP_PASS   = process.env.SMTP_PASSWORD || process.env.SMTP_PASS || '';

const FROM_EMAIL  = process.env.EMAIL_FROM      || 'noreply@proofpoint.id';
const FROM_NAME   = process.env.EMAIL_FROM_NAME || 'ProofPoint';

const EMAIL_ENABLED = process.env.EMAIL_ENABLED === 'true';
const EMAIL_DEBUG   = process.env.EMAIL_DEBUG   === 'true';
const TEST_MODE     = process.env.TEST_MODE     === 'true';
const TEST_EMAIL    = process.env.TEST_EMAIL    || '';

let _transporter: nodemailer.Transporter | null = null;
let _verified = false;

async function getTransporter(): Promise<nodemailer.Transporter> {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host:   SMTP_HOST,
      port:   SMTP_PORT,
      secure: SMTP_SECURE,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
  }

  if (!_verified) {
    try {
      await _transporter.verify();
      _verified = true;
      console.log(`✅ [EMAIL] SMTP connected: ${SMTP_HOST}:${SMTP_PORT} secure=${SMTP_SECURE}`);
    } catch (err: unknown) {
      // ✅ FIX: err: any → err: unknown
      const message = err instanceof Error ? err.message : String(err);
      _transporter = null;
      throw new Error(`SMTP verify failed: ${message}`);
    }
  }

  return _transporter;
}

export async function sendEmail(
  toOrOptions: string | { to: string; subject: string; html: string },
  subject?: string,
  html?: string
): Promise<{ success: boolean; messageId?: string; message?: string; error?: string }> {

  let to: string, finalSubject: string, finalHtml: string;
  if (typeof toOrOptions === 'object') {
    to           = toOrOptions.to;
    finalSubject = toOrOptions.subject;
    finalHtml    = toOrOptions.html;
  } else {
    to           = toOrOptions;
    finalSubject = subject || '';
    finalHtml    = html    || '';
  }

  if (EMAIL_DEBUG) {
    console.log(`📧 [EMAIL] To: ${to} | Subject: ${finalSubject}`);
    console.log(`📧 [EMAIL] ENABLED=${EMAIL_ENABLED} | TEST_MODE=${TEST_MODE} | SMTP=${SMTP_HOST}:${SMTP_PORT} secure=${SMTP_SECURE}`);
    console.log(`📧 [EMAIL] FROM: "${FROM_NAME}" <${FROM_EMAIL}> | USER: ${SMTP_USER}`);
  }

  if (!EMAIL_ENABLED) {
    console.log(`📧 [EMAIL DISABLED] Would send to: ${to} | ${finalSubject}`);
    return { success: true, message: 'Email disabled' };
  }

  if (!to) {
    console.error('❌ [EMAIL] No recipient provided');
    return { success: false, error: 'No recipient' };
  }

  let actualTo      = to;
  let actualSubject = finalSubject;
  let actualHtml    = finalHtml;

  if (TEST_MODE) {
    if (!TEST_EMAIL) {
      console.error('❌ [EMAIL] TEST_MODE=true tapi TEST_EMAIL tidak di-set di .env');
      return { success: false, error: 'TEST_EMAIL not set' };
    }
    actualTo      = TEST_EMAIL;
    actualSubject = `[TEST → ${to}] ${finalSubject}`;
    actualHtml    = `
      <div style="background:#fff3cd;padding:10px 16px;border:1px solid #ffc107;border-radius:4px;margin-bottom:16px;">
        <p style="margin:0;font-size:13px;">
          <strong>🔒 TEST MODE</strong> — Original recipient: <code>${escapeHtml(to)}</code>
        </p>
      </div>
      ${finalHtml}`;
    console.log(`🔒 [TEST MODE] Redirecting ${to} → ${actualTo}`);
  }

  try {
    const transporter = await getTransporter();
    const info = await transporter.sendMail({
      from:    `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to:      actualTo,
      subject: actualSubject,
      html:    actualHtml,
    });

    console.log(`✅ [EMAIL] Sent to: ${actualTo} | Message-ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId as string };
  } catch (error: unknown) {
    // ✅ FIX: error: any → error: unknown
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ [EMAIL] Failed to send to ${actualTo}:`, message);
    return { success: false, error: message };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}

// ─── Observation Notifications ────────────────────────────────────────────────

const BASE_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';

// ✅ FIX: observationId tidak dipakai → prefix _observationId (reserved untuk link detail masa depan)
export async function notifyObservationCreated(
  managerEmail:  string,
  staffName:     string,
  rubricName:    string,
  _observationId:string
) {
  return sendEmail({
    to:      managerEmail,
    subject: `Observation Baru: ${rubricName}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;">
      <h2>Observation Baru Ditugaskan</h2>
      <p>Anda ditugaskan untuk mengisi form observasi berikut:</p>
      <table style="border-collapse:collapse;width:100%;margin:12px 0;">
        <tr><td style="padding:6px 0;color:#555;width:120px;">Staff</td>
            <td style="font-weight:bold;">${escapeHtml(staffName)}</td></tr>
        <tr><td style="padding:6px 0;color:#555;">Rubric</td>
            <td style="font-weight:bold;">${escapeHtml(rubricName)}</td></tr>
      </table>
      <a href="${BASE_URL}/observations"
         style="display:inline-block;background:#16a34a;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">
        Isi Observasi
      </a>
      <p style="color:#999;font-size:12px;margin-top:24px;">Notifikasi otomatis - jangan balas email ini.</p>
    </div>`,
  });
}

export async function notifyObservationSubmitted(
  staffEmail:    string,
  staffName:     string,
  rubricName:    string,
  _observationId:string
) {
  return sendEmail({
    to:      staffEmail,
    subject: `Hasil Observasi Siap: ${rubricName}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;">
      <h2>Hasil Observasi Siap untuk Ditinjau</h2>
      <p>Halo <strong>${escapeHtml(staffName)}</strong>,</p>
      <p>Manager Anda telah menyelesaikan pengisian observasi. Silakan tinjau dan berikan acknowledgement.</p>
      <table style="border-collapse:collapse;width:100%;margin:12px 0;">
        <tr><td style="padding:6px 0;color:#555;width:120px;">Rubric</td>
            <td style="font-weight:bold;">${escapeHtml(rubricName)}</td></tr>
      </table>
      <a href="${BASE_URL}/observations"
         style="display:inline-block;background:#2563eb;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">
        Lihat dan Acknowledge
      </a>
      <p style="color:#999;font-size:12px;margin-top:24px;">Notifikasi otomatis - jangan balas email ini.</p>
    </div>`,
  });
}

export async function notifyObservationAcknowledged(
  adminEmail:    string,
  staffName:     string,
  managerName:   string,
  rubricName:    string,
  _observationId:string
) {
  return sendEmail({
    to:      adminEmail,
    subject: `Staff Acknowledge Observasi: ${rubricName}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;">
      <h2>Observasi Selesai Diakui</h2>
      <p>Staff telah melakukan acknowledgement atas hasil observasi.</p>
      <table style="border-collapse:collapse;width:100%;margin:12px 0;">
        <tr><td style="padding:6px 0;color:#555;width:120px;">Staff</td>
            <td style="font-weight:bold;">${escapeHtml(staffName)}</td></tr>
        <tr><td style="padding:6px 0;color:#555;">Manager</td>
            <td style="font-weight:bold;">${escapeHtml(managerName)}</td></tr>
        <tr><td style="padding:6px 0;color:#555;">Rubric</td>
            <td style="font-weight:bold;">${escapeHtml(rubricName)}</td></tr>
      </table>
      <a href="${BASE_URL}/observations"
         style="display:inline-block;background:#7c3aed;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">
        Lihat Detail
      </a>
      <p style="color:#999;font-size:12px;margin-top:24px;">Notifikasi otomatis - jangan balas email ini.</p>
    </div>`,
  });
}

// ─── Assessment Notifications ──────────────────────────────────────────────────

export const emailSubjects = {
  assessmentSubmitted:    (staffName: string) => `Assessment Submitted: ${staffName}`,
  managerReviewCompleted: (staffName: string) => `Manager Review Completed: ${staffName}`,
  directorApproved:       (staffName: string) => `Director Approved: ${staffName}`,
  adminReleased:          ()                  => `Assessment Released to Staff`,
  assessmentReturned:     ()                  => `Assessment Returned for Revision`,
  assessmentAcknowledged: (staffName: string) => `Assessment Acknowledged: ${staffName}`,
};

export const emailTemplates = {
  assessmentSubmitted: (data: Record<string, string>) => `
    <div style="font-family:Arial,sans-serif;max-width:600px;">
      <h2>Assessment Submitted</h2>
      <p>Manager <strong>${escapeHtml(data.managerName)}</strong> has submitted an assessment for <strong>${escapeHtml(data.staffName)}</strong>.</p>
      <table style="border-collapse:collapse;width:100%;margin:12px 0;">
        <tr><td style="padding:6px 0;color:#555;">Period</td>  <td style="font-weight:bold;">${escapeHtml(data.period)}</td></tr>
        <tr><td style="padding:6px 0;color:#555;">Template</td><td style="font-weight:bold;">${escapeHtml(data.templateName)}</td></tr>
        <tr><td style="padding:6px 0;color:#555;">Score</td>   <td style="font-weight:bold;">${data.score}</td></tr>
        <tr><td style="padding:6px 0;color:#555;">Grade</td>   <td style="font-weight:bold;">${escapeHtml(data.grade)}</td></tr>
      </table>
      <a href="${data.actionUrl}" style="display:inline-block;background:#16a34a;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;">Review Assessment</a>
    </div>`,

  managerReviewCompleted: (data: Record<string, string>) => `
    <div style="font-family:Arial,sans-serif;max-width:600px;">
      <h2>Manager Review Completed</h2>
      <p>Director <strong>${escapeHtml(data.directorName)}</strong>, manager <strong>${escapeHtml(data.managerName)}</strong> has completed review for <strong>${escapeHtml(data.staffName)}</strong>.</p>
      <a href="${data.actionUrl}" style="display:inline-block;background:#2563eb;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;">Review</a>
    </div>`,

  directorApproved: (data: Record<string, string>) => `
    <div style="font-family:Arial,sans-serif;max-width:600px;">
      <h2>Director Approved</h2>
      <p>Assessment for <strong>${escapeHtml(data.staffName)}</strong> has been approved.</p>
      <a href="${data.actionUrl}" style="display:inline-block;background:#7c3aed;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;">View Details</a>
    </div>`,

  adminReleased: (data: Record<string, string>) => `
    <div style="font-family:Arial,sans-serif;max-width:600px;">
      <h2>Assessment Released</h2>
      <p>Dear <strong>${escapeHtml(data.staffName)}</strong>, your assessment has been released.</p>
      <a href="${data.actionUrl}" style="display:inline-block;background:#16a34a;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;">View Assessment</a>
    </div>`,

  assessmentReturned: (data: Record<string, string>) => `
    <div style="font-family:Arial,sans-serif;max-width:600px;">
      <h2>Assessment Returned</h2>
      <p>Your assessment has been returned by <strong>${escapeHtml(data.returnedBy)}</strong>.</p>
      <div style="background:#fef3c7;padding:12px;border-radius:6px;margin:12px 0;">
        <p style="margin:0;color:#92400e;"><strong>Feedback:</strong> ${escapeHtml(data.feedback)}</p>
      </div>
      <a href="${data.actionUrl}" style="display:inline-block;background:#f59e0b;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;">Revise Assessment</a>
    </div>`,

  assessmentAcknowledged: (data: Record<string, string>) => `
    <div style="font-family:Arial,sans-serif;max-width:600px;">
      <h2>Assessment Acknowledged</h2>
      <p><strong>${escapeHtml(data.staffName)}</strong> has acknowledged the assessment.</p>
      <a href="${data.actionUrl}" style="display:inline-block;background:#16a34a;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;">View Details</a>
    </div>`,
};