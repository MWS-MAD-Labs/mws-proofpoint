import { sendEmail, type EmailResult } from "@/lib/email";
import {
  getObservationNotificationSettings,
  isObservationNotificationEventEnabled,
  type ObservationNotificationEvent,
  type ObservationNotificationSettings,
} from "@/features/observations/server/notificationSettings";

const BASE_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";
const CARD_STYLE =
  "font-family:Nunito Sans,Arial,sans-serif;max-width:600px;color:#241718;background:#FFFFFF;border:1px solid #D8C9C3;border-radius:16px;padding:24px;";
const BUTTON_STYLE =
  "display:inline-block;background:#1F2A44;color:white;padding:10px 20px;border-radius:12px;text-decoration:none;font-weight:bold;";

async function sendObservationEmail(
  event: ObservationNotificationEvent,
  params: { to: string; subject: string; html: string; text?: string },
  settings?: ObservationNotificationSettings,
): Promise<EmailResult> {
  const currentSettings =
    settings ?? (await getObservationNotificationSettings());
  if (!isObservationNotificationEventEnabled(currentSettings, event)) {
    return { success: true };
  }
  return sendEmail(params);
}

function esc(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function observationLink(observationId: string): string {
  return `${BASE_URL}/observations/${encodeURIComponent(observationId)}`;
}

export async function notifyObservationAssigned(
  recipientUserId: string,
  managerEmail: string,
  managerName: string,
  staffName: string,
  rubricName: string,
  observationId: string,
) {
  void recipientUserId;
  void managerEmail;
  void managerName;
  void staffName;
  void rubricName;
  void observationId;
  return { success: true } satisfies EmailResult;
}

export async function notifyObservationReassigned(
  recipientUserId: string,
  email: string,
  recipientName: string,
  staffName: string,
  rubricName: string,
  observationId: string,
  assigned: boolean,
  settings?: ObservationNotificationSettings,
) {
  void recipientUserId;
  return sendObservationEmail("reassignment", {
    to: email,
    subject: assigned
      ? `Observation reassigned to you: ${rubricName}`
      : `Observation reassigned: ${rubricName}`,
    html: `<div style="${CARD_STYLE}">
      <h2>${assigned ? "Observation Assigned to You" : "Observation Assignment Changed"}</h2>
      <p>Hello <strong>${esc(recipientName)}</strong>,</p>
      <p>${assigned
        ? `You are now responsible for the observation of <strong>${esc(staffName)}</strong>.`
        : `The observation of <strong>${esc(staffName)}</strong> has been assigned to another observer.`}</p>
      <p><strong>Form:</strong> ${esc(rubricName)}</p>
      <a href="${observationLink(observationId)}${assigned ? "/edit" : ""}" style="${BUTTON_STYLE}">View Observation</a>
      <p style="color:#6F6061;font-size:12px;margin-top:24px;">This is an automated notification.</p>
    </div>`,
  }, settings);
}

export async function notifyObservationSubmitted(
  staffUserId: string,
  staffEmail: string,
  staffName: string,
  managerName: string,
  observationTitle: string,
  observationId: string,
  settings?: ObservationNotificationSettings,
) {
  void staffUserId;
  return sendObservationEmail("submission", {
    to: staffEmail,
    subject: `Observation Results Ready: ${observationTitle}`,
    html: `<div style="${CARD_STYLE}">
      <h2>Observation Results Ready for Review</h2>
      <p>Hello <strong>${esc(staffName)}</strong>,</p>
      <p><strong>${esc(managerName)}</strong> has submitted an observation that is waiting for your acknowledgement.</p>
      <table style="border-collapse:collapse;width:100%;margin:12px 0;">
        <tr><td style="padding:6px 0;color:#5D4B4C;width:120px;">Observer</td><td style="font-weight:bold;">${esc(managerName)}</td></tr>
        <tr><td style="padding:6px 0;color:#5D4B4C;">Observation</td><td style="font-weight:bold;">${esc(observationTitle)}</td></tr>
      </table>
      <a href="${observationLink(observationId)}" style="${BUTTON_STYLE}">Review and Acknowledge</a>
      <p style="color:#6F6061;font-size:12px;margin-top:24px;">This is an automated notification. Please do not reply to this email.</p>
    </div>`,
  }, settings);
}

export async function notifyObservationAcknowledgementReminder(
  staffUserId: string,
  staffEmail: string,
  staffName: string,
  managerName: string,
  observationTitle: string,
  observationId: string,
  settings?: ObservationNotificationSettings,
) {
  void staffUserId;
  return sendObservationEmail("reminder", {
    to: staffEmail,
    subject: `Reminder: observation awaiting acknowledgement — ${observationTitle}`,
    html: `<div style="${CARD_STYLE}">
      <h2>Observation Still Awaiting Acknowledgement</h2>
      <p>Hello <strong>${esc(staffName)}</strong>,</p>
      <p>This is a reminder that the observation below is still waiting for your acknowledgement.</p>
      <table style="border-collapse:collapse;width:100%;margin:12px 0;">
        <tr><td style="padding:6px 0;color:#5D4B4C;width:120px;">Submitted by</td><td style="font-weight:bold;">${esc(managerName)}</td></tr>
        <tr><td style="padding:6px 0;color:#5D4B4C;">Observation</td><td style="font-weight:bold;">${esc(observationTitle)}</td></tr>
      </table>
      <a href="${observationLink(observationId)}" style="${BUTTON_STYLE}">Review and Acknowledge</a>
      <p style="color:#6F6061;font-size:12px;margin-top:24px;">This is an automated notification. Please do not reply to this email.</p>
    </div>`,
  }, settings);
}

export async function notifyManagerObservationAcknowledged(
  managerUserId: string,
  managerEmail: string,
  staffName: string,
  managerName: string,
  observationTitle: string,
  observationId: string,
  settings?: ObservationNotificationSettings,
) {
  void managerUserId;
  return sendObservationEmail("personalAcknowledgement", {
    to: managerEmail,
    subject: `Staff Acknowledged Observation: ${observationTitle}`,
    html: `<div style="${CARD_STYLE}">
      <h2>Observation Personally Acknowledged</h2>
      <p>Hello <strong>${esc(managerName)}</strong>,</p>
      <p><strong>${esc(staffName)}</strong> personally acknowledged the observation results you submitted.</p>
      <p><strong>Observation:</strong> ${esc(observationTitle)}</p>
      <a href="${observationLink(observationId)}" style="${BUTTON_STYLE}">View Details</a>
      <p style="color:#6F6061;font-size:12px;margin-top:24px;">This is an automated notification. Please do not reply to this email.</p>
    </div>`,
  }, settings);
}

export async function notifyObservationAcknowledged(
  adminUserId: string,
  adminEmail: string,
  staffName: string,
  managerName: string,
  observationTitle: string,
  observationId: string,
  settings?: ObservationNotificationSettings,
) {
  void adminUserId;
  return sendObservationEmail("personalAcknowledgement", {
    to: adminEmail,
    subject: `Staff Acknowledged Observation: ${observationTitle}`,
    html: `<div style="${CARD_STYLE}">
      <h2>Observation Personally Acknowledged</h2>
      <p>The staff member personally acknowledged the observation results.</p>
      <p><strong>Staff:</strong> ${esc(staffName)}</p>
      <p><strong>Observer:</strong> ${esc(managerName)}</p>
      <p><strong>Observation:</strong> ${esc(observationTitle)}</p>
      <a href="${observationLink(observationId)}" style="${BUTTON_STYLE}">View Details</a>
      <p style="color:#6F6061;font-size:12px;margin-top:24px;">This is an automated notification. Please do not reply to this email.</p>
    </div>`,
  }, settings);
}

export async function notifyObservationAutomaticallyAcknowledged(
  recipientUserId: string,
  email: string,
  recipientName: string,
  staffName: string,
  managerName: string,
  observationTitle: string,
  observationId: string,
  settings?: ObservationNotificationSettings,
) {
  void recipientUserId;
  return sendObservationEmail("automaticAcknowledgement", {
    to: email,
    subject: `Observation Automatically Acknowledged: ${observationTitle}`,
    html: `<div style="${CARD_STYLE}">
      <h2>Observation Automatically Acknowledged</h2>
      <p>Hello <strong>${esc(recipientName)}</strong>,</p>
      <p>The observation below was automatically marked as acknowledged because the response deadline passed.</p>
      <p style="font-weight:bold;color:#8A4B08;">The staff member did not personally acknowledge this observation.</p>
      <table style="border-collapse:collapse;width:100%;margin:12px 0;">
        <tr><td style="padding:6px 0;color:#5D4B4C;width:120px;">Staff</td><td style="font-weight:bold;">${esc(staffName)}</td></tr>
        <tr><td style="padding:6px 0;color:#5D4B4C;">Observer</td><td style="font-weight:bold;">${esc(managerName)}</td></tr>
        <tr><td style="padding:6px 0;color:#5D4B4C;">Observation</td><td style="font-weight:bold;">${esc(observationTitle)}</td></tr>
      </table>
      <a href="${observationLink(observationId)}" style="${BUTTON_STYLE}">View Details</a>
      <p style="color:#6F6061;font-size:12px;margin-top:24px;">This is an automated notification. Please do not reply to this email.</p>
    </div>`,
  }, settings);
}

export async function notifyManagerObservationReopened(
  managerUserId: string,
  managerEmail: string,
  managerName: string,
  staffName: string,
  rubricName: string,
  reason: string,
  observationId: string,
  settings?: ObservationNotificationSettings,
) {
  void managerUserId;
  return sendObservationEmail("reopen", {
    to: managerEmail,
    subject: `Observation Reopened: ${rubricName}`,
    html: `<div style="${CARD_STYLE}">
      <h2>Observation Reopened for Revision</h2>
      <p>Hello <strong>${esc(managerName)}</strong>,</p>
      <p>An administrator reopened the observation for <strong>${esc(staffName)}</strong>. The report is now a draft and requires revision before it can be submitted again.</p>
      <p><strong>Reason:</strong> ${esc(reason)}</p>
      <a href="${observationLink(observationId)}/edit" style="${BUTTON_STYLE}">Continue Editing</a>
      <p style="color:#6F6061;font-size:12px;margin-top:24px;">This is an automated notification.</p>
    </div>`,
  }, settings);
}
