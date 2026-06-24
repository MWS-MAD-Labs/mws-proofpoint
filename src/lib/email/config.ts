export const emailConfig = {
  enabled: process.env.EMAIL_ENABLED === 'true',
  debug: process.env.EMAIL_DEBUG === 'true',
  service: process.env.EMAIL_SERVICE || 'nodemailer',
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
  resend: {
    apiKey: process.env.RESEND_API_KEY,
  },
} as const;

export type EmailConfig = typeof emailConfig;
