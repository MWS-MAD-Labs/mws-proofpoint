// src/lib/notifications/observation-notifications.ts
import { sendEmail } from "@/lib/email";

const BASE_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";

function esc(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function notifyObservationAssigned(
  managerEmail: string,
  managerName: string,
  staffName: string,
  rubricName: string,
  observationId: string,
) {
  return sendEmail({
    to: managerEmail,
    subject: `Observation assigned: ${rubricName}`,
    html: `<div style="font-family:Nunito Sans,Arial,sans-serif;max-width:600px;color:#241718;background:#FFFFFF;border:1px solid #D8C9C3;border-radius:16px;padding:24px;">
      <h2>Observation Draft Assigned</h2>
      <p>Hello <strong>${esc(managerName)}</strong>,</p>
      <p>An observation draft for <strong>${esc(staffName)}</strong> has been assigned to you.</p>
      <p><strong>Form:</strong> ${esc(rubricName)}</p>
      <a href="${BASE_URL}/observations/${encodeURIComponent(observationId)}/edit"
         style="display:inline-block;background:#1F2A44;color:white;padding:10px 20px;border-radius:12px;text-decoration:none;font-weight:bold;">
        Start Observation
      </a>
      <p style="color:#6F6061;font-size:12px;margin-top:24px;">This is an automated notification.</p>
    </div>`,
  });
}

export async function notifyObservationReassigned(
  email: string,
  recipientName: string,
  staffName: string,
  rubricName: string,
  observationId: string,
  assigned: boolean,
) {
  return sendEmail({
    to: email,
    subject: assigned
      ? `Observation reassigned to you: ${rubricName}`
      : `Observation reassigned: ${rubricName}`,
    html: `<div style="font-family:Nunito Sans,Arial,sans-serif;max-width:600px;color:#241718;background:#FFFFFF;border:1px solid #D8C9C3;border-radius:16px;padding:24px;">
      <h2>${assigned ? "Observation Assigned to You" : "Observation Assignment Changed"}</h2>
      <p>Hello <strong>${esc(recipientName)}</strong>,</p>
      <p>${assigned
        ? `You are now responsible for the observation of <strong>${esc(staffName)}</strong>.`
        : `The observation of <strong>${esc(staffName)}</strong> has been assigned to another manager.`}</p>
      <p><strong>Form:</strong> ${esc(rubricName)}</p>
      <a href="${BASE_URL}/observations/${encodeURIComponent(observationId)}${assigned ? "/edit" : ""}"
         style="display:inline-block;background:#1F2A44;color:white;padding:10px 20px;border-radius:12px;text-decoration:none;font-weight:bold;">
        View Observation
      </a>
      <p style="color:#6F6061;font-size:12px;margin-top:24px;">This is an automated notification.</p>
    </div>`,
  });
}

// ── Notify staff when manager submits (staff needs to acknowledge) ───────────
export async function notifyObservationSubmitted(
  staffEmail:     string,
  staffName:      string,
  rubricName:     string,
  observationId: string
) {
  return sendEmail({
    to:      staffEmail,
    subject: `Observation Results Ready: ${rubricName}`,
    html: `<div style="font-family:Nunito Sans,Arial,sans-serif;max-width:600px;color:#241718;background:#FFFFFF;border:1px solid #D8C9C3;border-radius:16px;padding:24px;">
      <h2>Observation Results Ready for Review</h2>
      <p>Hello <strong>${esc(staffName)}</strong>,</p>
      <p>Your manager has completed the observation. Please review the results and acknowledge them.</p>
      <table style="border-collapse:collapse;width:100%;margin:12px 0;">
        <tr><td style="padding:6px 0;color:#5D4B4C;width:120px;">Rubric</td>
            <td style="font-weight:bold;">${esc(rubricName)}</td></tr>
      </table>
      <a href="${BASE_URL}/observations/${encodeURIComponent(observationId)}"
         style="display:inline-block;background:#1F2A44;color:white;padding:10px 20px;border-radius:12px;text-decoration:none;font-weight:bold;">
        Review and Acknowledge
      </a>
      <p style="color:#6F6061;font-size:12px;margin-top:24px;">This is an automated notification. Please do not reply to this email.</p>
    </div>`,
  });
}

// ── Milestone 5: Notify manager when staff acknowledges ──────────────────────
export async function notifyManagerObservationAcknowledged(
  managerEmail:   string,
  staffName:      string,
  managerName:    string,
  rubricName:     string,
  observationId: string
) {
  return sendEmail({
    to:      managerEmail,
    subject: `✅ Staff Acknowledged Observation: ${rubricName}`,
    html: `<div style="font-family:Nunito Sans,Arial,sans-serif;max-width:600px;color:#241718;background:#FFFFFF;border:1px solid #D8C9C3;border-radius:16px;padding:24px;">
      <h2>Observation Acknowledged by Staff Member</h2>
      <p>Hello <strong>${esc(managerName)}</strong>,</p>
      <p>Your staff member has acknowledged the observation results you submitted.</p>
      <table style="border-collapse:collapse;width:100%;margin:12px 0;">
        <tr><td style="padding:6px 0;color:#5D4B4C;width:120px;">Staff</td>
            <td style="font-weight:bold;">${esc(staffName)}</td></tr>
        <tr><td style="padding:6px 0;color:#5D4B4C;">Rubric</td>
            <td style="font-weight:bold;">${esc(rubricName)}</td></tr>
        <tr><td style="padding:6px 0;color:#5D4B4C;">Status</td>
            <td style="font-weight:bold;color:#486142;">Acknowledged ✅</td></tr>
      </table>
      <a href="${BASE_URL}/observations/${encodeURIComponent(observationId)}"
         style="display:inline-block;background:#1F2A44;color:white;padding:10px 20px;border-radius:12px;text-decoration:none;font-weight:bold;">
        View Details
      </a>
      <p style="color:#6F6061;font-size:12px;margin-top:24px;">This is an automated notification. Please do not reply to this email.</p>
    </div>`,
  });
}

// ── Notify admin when any observation is acknowledged ───────────────────────
export async function notifyObservationAcknowledged(
  adminEmail:     string,
  staffName:      string,
  managerName:    string,
  rubricName:     string,
  observationId: string
) {
  return sendEmail({
    to:      adminEmail,
    subject: `Staff Acknowledged Observation: ${rubricName}`,
    html: `<div style="font-family:Nunito Sans,Arial,sans-serif;max-width:600px;color:#241718;background:#FFFFFF;border:1px solid #D8C9C3;border-radius:16px;padding:24px;">
      <h2>Observation Acknowledgement Completed</h2>
      <p>The staff member has acknowledged the observation results.</p>
      <table style="border-collapse:collapse;width:100%;margin:12px 0;">
        <tr><td style="padding:6px 0;color:#5D4B4C;width:120px;">Staff</td>
            <td style="font-weight:bold;">${esc(staffName)}</td></tr>
        <tr><td style="padding:6px 0;color:#5D4B4C;">Manager</td>
            <td style="font-weight:bold;">${esc(managerName)}</td></tr>
        <tr><td style="padding:6px 0;color:#5D4B4C;">Rubric</td>
            <td style="font-weight:bold;">${esc(rubricName)}</td></tr>
      </table>
      <a href="${BASE_URL}/observations/${encodeURIComponent(observationId)}"
         style="display:inline-block;background:#1F2A44;color:white;padding:10px 20px;border-radius:12px;text-decoration:none;font-weight:bold;">
        View Details
      </a>
      <p style="color:#6F6061;font-size:12px;margin-top:24px;">This is an automated notification. Please do not reply to this email.</p>
    </div>`,
  });
}

export async function notifyManagerObservationReopened(
  managerEmail: string,
  managerName: string,
  staffName: string,
  rubricName: string,
  reason: string,
  observationId: string,
) {
  return sendEmail({
    to: managerEmail,
    subject: `Observation Reopened: ${rubricName}`,
    html: `<div style="font-family:Nunito Sans,Arial,sans-serif;max-width:600px;color:#241718;background:#FFFFFF;border:1px solid #D8C9C3;border-radius:16px;padding:24px;">
      <h2>Observation Reopened for Revision</h2>
      <p>Hello <strong>${esc(managerName)}</strong>,</p>
      <p>An administrator reopened the observation for <strong>${esc(staffName)}</strong>. The report is now a draft and requires revision before it can be submitted again.</p>
      <p><strong>Reason:</strong> ${esc(reason)}</p>
      <a href="${BASE_URL}/observations/${encodeURIComponent(observationId)}/edit"
         style="display:inline-block;background:#1F2A44;color:white;padding:10px 20px;border-radius:12px;text-decoration:none;font-weight:bold;">
        Continue Editing
      </a>
      <p style="color:#6F6061;font-size:12px;margin-top:24px;">This is an automated notification.</p>
    </div>`,
  });
}
