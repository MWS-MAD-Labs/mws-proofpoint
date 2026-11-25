import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import nodemailer from 'nodemailer';
import MailComposer from 'nodemailer/lib/mail-composer';
import type { EmailParams, EmailProvider, EmailResult } from './types';

const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.send';

type ServiceAccount = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

function env(name: string): string {
  return process.env[name]?.trim() || '';
}

function emailProvider(): EmailProvider {
  const provider = (env('EMAIL_PROVIDER') || 'smtp').toLowerCase();
  if (provider === 'gmail' || provider === 'smtp') return provider;
  throw new Error(`EMAIL_PROVIDER must be gmail or smtp, not "${provider}"`);
}

export function parseServiceAccount(raw: string): ServiceAccount {
  const trimmed = raw.trim();
  const text = trimmed.startsWith('{')
    ? trimmed
    : Buffer.from(trimmed, 'base64').toString('utf8');
  let parsed: Partial<ServiceAccount> & { type?: string };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Gmail service account credentials are not valid JSON');
  }
  if (
    parsed.type !== 'service_account' ||
    !parsed.client_email ||
    !parsed.private_key
  ) {
    throw new Error(
      'Gmail credentials must be a service account key with client_email and private_key',
    );
  }
  return {
    client_email: parsed.client_email,
    private_key: parsed.private_key,
    token_uri: parsed.token_uri,
  };
}

let serviceAccount: ServiceAccount | null = null;
let cachedToken: {
  value: string;
  subject: string;
  expiresAt: number;
} | null = null;
let smtpTransporter: nodemailer.Transporter | null = null;

function credentialsFile(): string {
  return (
    env('GMAIL_CREDENTIALS_FILE') ||
    env('PROOFPOINT_GMAIL_CREDENTIALS_FILE') ||
    env('Proofpoint_GMAIL_CREDENTIALS_FILE')
  );
}

function loadServiceAccount(): ServiceAccount {
  if (serviceAccount) return serviceAccount;
  const inline = env('GMAIL_CREDENTIALS_JSON');
  if (inline) return (serviceAccount = parseServiceAccount(inline));

  const file = credentialsFile();
  if (!file) {
    throw new Error(
      'GMAIL_CREDENTIALS_JSON or Proofpoint_GMAIL_CREDENTIALS_FILE is required for Gmail delivery',
    );
  }
  let raw: string;
  try {
    raw = readFileSync(path.resolve(process.cwd(), file), 'utf8');
  } catch {
    throw new Error(`Gmail credentials file not found at ${file}`);
  }
  return (serviceAccount = parseServiceAccount(raw));
}

function base64Url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

export function serviceAccountAssertion(
  account: ServiceAccount,
  subject: string,
  now = Math.floor(Date.now() / 1000),
): string {
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64Url(
    JSON.stringify({
      iss: account.client_email,
      sub: subject,
      scope: GMAIL_SCOPE,
      aud: account.token_uri || 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  );
  const signature = createSign('RSA-SHA256')
    .update(`${header}.${claims}`)
    .sign(account.private_key);
  return `${header}.${claims}.${base64Url(signature)}`;
}

async function gmailAccessToken(
  account: ServiceAccount,
  sender: string,
  fetchImpl: typeof fetch,
): Promise<string> {
  if (
    cachedToken &&
    cachedToken.subject === sender &&
    cachedToken.expiresAt - 60_000 > Date.now()
  ) {
    return cachedToken.value;
  }

  const response = await fetchImpl(
    account.token_uri || 'https://oauth2.googleapis.com/token',
    {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: serviceAccountAssertion(account, sender),
      }),
      signal: AbortSignal.timeout(10_000),
    },
  );
  const body = (await response.json().catch(() => null)) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  } | null;
  if (!response.ok || !body?.access_token) {
    const reason =
      body?.error_description || body?.error || `HTTP ${response.status}`;
    throw new Error(`Gmail token request failed for ${sender}: ${reason}`);
  }
  cachedToken = {
    value: body.access_token,
    subject: sender,
    expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
  };
  return body.access_token;
}

function validEmails(to: string | string[]): string[] {
  const emails = Array.isArray(to) ? to : [to];
  return emails
    .map((email) => email.trim())
    .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
}

export async function sendWithGmail(
  params: EmailParams,
  fetchImpl: typeof fetch = fetch,
): Promise<EmailResult> {
  const recipients = validEmails(params.to);
  if (recipients.length === 0) {
    return { success: false, error: 'No valid email addresses provided' };
  }
  const sender = env('GMAIL_SENDER_EMAIL');
  if (!sender) throw new Error('GMAIL_SENDER_EMAIL is required for Gmail delivery');
  const senderName = (env('GMAIL_SENDER_NAME') || 'ProofPoint Notifications')
    .replace(/["\\]/g, '');
  const raw = await new MailComposer({
    from: `${senderName} <${sender}>`,
    to: recipients.join(', '),
    subject: params.subject,
    html: params.html,
    text: params.text,
  })
    .compile()
    .build();
  const token = await gmailAccessToken(loadServiceAccount(), sender, fetchImpl);
  const response = await fetchImpl(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ raw: base64Url(raw) }),
      signal: AbortSignal.timeout(15_000),
    },
  );
  const body = (await response.json().catch(() => null)) as {
    id?: string;
    error?: { message?: string };
  } | null;
  if (!response.ok || !body?.id) {
    throw new Error(
      `Gmail send failed: ${body?.error?.message || `HTTP ${response.status}`}`,
    );
  }
  return { success: true, messageId: body.id };
}

function smtpClient(): nodemailer.Transporter {
  smtpTransporter ??= nodemailer.createTransport({
    host: env('SMTP_HOST') || 'smtp.gmail.com',
    port: Number(env('SMTP_PORT') || 465),
    secure: (env('SMTP_SECURE') || 'true').toLowerCase() === 'true',
    auth: {
      user: env('SMTP_USER'),
      pass: env('SMTP_PASSWORD'),
    },
  });
  return smtpTransporter;
}

export function createEmailClient(): nodemailer.Transporter {
  if (emailProvider() !== 'smtp') {
    throw new Error('createEmailClient is only available for EMAIL_PROVIDER=smtp');
  }
  return smtpClient();
}

async function sendWithSmtp(params: EmailParams): Promise<EmailResult> {
  const recipients = validEmails(params.to);
  if (recipients.length === 0) {
    return { success: false, error: 'No valid email addresses provided' };
  }
  const user = env('SMTP_USER');
  const password = env('SMTP_PASSWORD');
  if (!user || !password) {
    throw new Error('SMTP_USER and SMTP_PASSWORD are required for SMTP delivery');
  }
  const info = await smtpClient().sendMail({
    from: `${env('EMAIL_FROM_NAME') || 'ProofPoint Dashboard'} <${env('EMAIL_FROM') || user}>`,
    to: recipients.join(', '),
    subject: params.subject,
    html: params.html,
    text: params.text,
  });
  return { success: true, messageId: info.messageId };
}

export async function sendEmail(params: EmailParams): Promise<EmailResult> {
  if (process.env.EMAIL_ENABLED !== 'true') {
    if (process.env.EMAIL_DEBUG === 'true') {
      console.log('[Email] Email disabled, skipping send');
    }
    return { success: true };
  }

  try {
    const result =
      emailProvider() === 'gmail'
        ? await sendWithGmail(params)
        : await sendWithSmtp(params);
    if (process.env.EMAIL_DEBUG === 'true') {
      console.log('[Email] Sent:', result.messageId);
    }
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Email] Send failed:', message);
    return { success: false, error: message };
  }
}

export function resetEmailClientForTest(): void {
  serviceAccount = null;
  cachedToken = null;
  smtpTransporter = null;
}
