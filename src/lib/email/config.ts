export const emailConfig = {
  enabled: process.env.EMAIL_ENABLED === 'true',
  debug: process.env.EMAIL_DEBUG === 'true',
  provider: process.env.EMAIL_PROVIDER || 'smtp',
  from: {
    email: process.env.EMAIL_FROM || 'noreply@proofpoint.local',
    name: process.env.EMAIL_FROM_NAME || 'ProofPoint Dashboard',
  },
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
  },
  gmail: {
    credentialsFile:
      process.env.GMAIL_CREDENTIALS_FILE ||
      process.env.PROOFPOINT_GMAIL_CREDENTIALS_FILE ||
      process.env.Proofpoint_GMAIL_CREDENTIALS_FILE,
    credentialsJson: process.env.GMAIL_CREDENTIALS_JSON,
    senderEmail: process.env.GMAIL_SENDER_EMAIL,
    senderName: process.env.GMAIL_SENDER_NAME || 'ProofPoint Notifications',
  },
} as const;

export type EmailConfig = typeof emailConfig;
