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

// ── Notify staff when manager creates observation ────────────────────────────
export async function notifyObservationCreated(
  staffEmail:     string,
  staffName:      string,
  rubricName:     string,
  _observationId: string
) {
  return sendEmail({
    to:      staffEmail,
    subject: `Observation Baru: ${rubricName}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;">
      <h2>Observation Baru Ditugaskan</h2>
      <p>Halo <strong>${esc(staffName)}</strong>,</p>
      <p>Manager Anda telah membuat observation untuk Anda. Anda akan menerima notifikasi saat hasilnya siap untuk ditinjau.</p>
      <table style="border-collapse:collapse;width:100%;margin:12px 0;">
        <tr><td style="padding:6px 0;color:#555;width:120px;">Rubric</td>
            <td style="font-weight:bold;">${esc(rubricName)}</td></tr>
      </table>
      <a href="${BASE_URL}/observations"
         style="display:inline-block;background:#16a34a;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">
        Lihat Observation
      </a>
      <p style="color:#999;font-size:12px;margin-top:24px;">Notifikasi otomatis - jangan balas email ini.</p>
    </div>`,
  });
}

// ── Notify staff when manager submits (staff needs to acknowledge) ───────────
export async function notifyObservationSubmitted(
  staffEmail:     string,
  staffName:      string,
  rubricName:     string,
  _observationId: string
) {
  return sendEmail({
    to:      staffEmail,
    subject: `Hasil Observasi Siap: ${rubricName}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;">
      <h2>Hasil Observasi Siap untuk Ditinjau</h2>
      <p>Halo <strong>${esc(staffName)}</strong>,</p>
      <p>Manager Anda telah menyelesaikan pengisian observasi. Silakan tinjau hasilnya dan berikan acknowledgement.</p>
      <table style="border-collapse:collapse;width:100%;margin:12px 0;">
        <tr><td style="padding:6px 0;color:#555;width:120px;">Rubric</td>
            <td style="font-weight:bold;">${esc(rubricName)}</td></tr>
      </table>
      <a href="${BASE_URL}/observations"
         style="display:inline-block;background:#2563eb;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">
        Lihat dan Acknowledge
      </a>
      <p style="color:#999;font-size:12px;margin-top:24px;">Notifikasi otomatis - jangan balas email ini.</p>
    </div>`,
  });
}

// ── Milestone 5: Notify manager when staff acknowledges ──────────────────────
export async function notifyManagerObservationAcknowledged(
  managerEmail:   string,
  staffName:      string,
  managerName:    string,
  rubricName:     string,
  _observationId: string
) {
  return sendEmail({
    to:      managerEmail,
    subject: `✅ Staff Acknowledge Observasi: ${rubricName}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;">
      <h2>Observasi Telah Diakui oleh Staff</h2>
      <p>Halo <strong>${esc(managerName)}</strong>,</p>
      <p>Staff Anda telah melakukan acknowledgement atas hasil observasi yang Anda isi.</p>
      <table style="border-collapse:collapse;width:100%;margin:12px 0;">
        <tr><td style="padding:6px 0;color:#555;width:120px;">Staff</td>
            <td style="font-weight:bold;">${esc(staffName)}</td></tr>
        <tr><td style="padding:6px 0;color:#555;">Rubric</td>
            <td style="font-weight:bold;">${esc(rubricName)}</td></tr>
        <tr><td style="padding:6px 0;color:#555;">Status</td>
            <td style="font-weight:bold;color:#16a34a;">Acknowledged ✅</td></tr>
      </table>
      <a href="${BASE_URL}/observations"
         style="display:inline-block;background:#7c3aed;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">
        Lihat Detail
      </a>
      <p style="color:#999;font-size:12px;margin-top:24px;">Notifikasi otomatis - jangan balas email ini.</p>
    </div>`,
  });
}

// ── Notify admin when any observation is acknowledged ───────────────────────
export async function notifyObservationAcknowledged(
  adminEmail:     string,
  staffName:      string,
  managerName:    string,
  rubricName:     string,
  _observationId: string
) {
  return sendEmail({
    to:      adminEmail,
    subject: `Staff Acknowledge Observasi: ${rubricName}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;">
      <h2>Observasi Selesai Diakui</h2>
      <p>Staff telah melakukan acknowledgement atas hasil observasi.</p>
      <table style="border-collapse:collapse;width:100%;margin:12px 0;">
        <tr><td style="padding:6px 0;color:#555;width:120px;">Staff</td>
            <td style="font-weight:bold;">${esc(staffName)}</td></tr>
        <tr><td style="padding:6px 0;color:#555;">Manager</td>
            <td style="font-weight:bold;">${esc(managerName)}</td></tr>
        <tr><td style="padding:6px 0;color:#555;">Rubric</td>
            <td style="font-weight:bold;">${esc(rubricName)}</td></tr>
      </table>
      <a href="${BASE_URL}/observations"
         style="display:inline-block;background:#7c3aed;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">
        Lihat Detail
      </a>
      <p style="color:#999;font-size:12px;margin-top:24px;">Notifikasi otomatis - jangan balas email ini.</p>
    </div>`,
  });
}