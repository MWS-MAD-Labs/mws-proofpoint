# Email Notification Integration Plan

## Overview

This document outlines the detailed implementation plan for email notifications in the ProofPoint Dashboard assessment system. Each phase includes specific files to create/modify, code structure, and completion criteria.

---

## Current System Analysis

### Technology Stack
- **Framework**: Next.js 15 with App Router
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js v5 (beta)
- **Deployment**: Docker with GitHub Actions CI/CD

### Assessment Workflow
```
draft → self_submitted → manager_reviewed → director_approved → admin_reviewed → acknowledged
                                      ↓
                                   rejected/returned
```

---

## Notification Events Summary

| Event | Trigger | Recipient | Subject Line |
|-------|---------|-----------|--------------|
| Assessment Submitted | draft → self_submitted | Manager | "Action Required: [Staff Name] submitted assessment for review" |
| Manager Review Done | self_submitted → manager_reviewed | Director | "Action Required: Manager review completed for [Staff Name]" |
| Director Approved | manager_reviewed → director_approved | Admin | "Action Required: Assessment approved for [Staff Name]" |
| Admin Released | director_approved → admin_reviewed | Staff | "Your assessment has been released - Action Required" |
| Assessment Returned | Any → rejected/returned | Staff | "Assessment returned: Please review and resubmit" |
| Acknowledged | admin_reviewed → acknowledged | Manager, Director | "Assessment cycle completed for [Staff Name]" |

---

## Implementation Phases

---

## Phase 1: Email Service Setup

### Objectives
Set up the email service infrastructure with provider-agnostic abstraction.

### Tasks

#### 1.1 Update `.env.example`
**File**: `/Users/faisalnurhidayat/repo/ProofPoint-Dashboard/.env.example`

**Add the following variables**:
```env
# Email Service Configuration
EMAIL_SERVICE=nodemailer  # Options: nodemailer, resend, sendgrid, ses
EMAIL_FROM=your-email@gmail.com
EMAIL_FROM_NAME=ProofPoint Dashboard

# Nodemailer with Gmail (for development)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Resend (for production)
# RESEND_API_KEY=re_xxxxxxxxxxxxx

# Email Preferences
EMAIL_ENABLED=true
EMAIL_DEBUG=false
```

**Completion Criteria**:
- [ ] `.env.example` updated with all email configuration variables
- [ ] Documentation comments included for each provider option

---

#### 1.2 Install Dependencies

**File**: `package.json`

**Command**:
```bash
npm install nodemailer
# For production with Resend:
# npm install resend
```

**Completion Criteria**:
- [ ] `nodemailer` added to `dependencies` in `package.json`
- [ ] `npm install` completed successfully
- [ ] No peer dependency warnings

---

#### 1.3 Create Email Configuration

**New File**: `src/lib/email/config.ts`

**Content**:
```typescript
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
```

**Completion Criteria**:
- [ ] File created at `src/lib/email/config.ts`
- [ ] TypeScript types properly exported
- [ ] Configuration validates environment variables

---

#### 1.4 Create Email Types

**New File**: `src/lib/email/types.ts`

**Content**:
```typescript
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
```

**Completion Criteria**:
- [ ] File created at `src/lib/email/types.ts`
- [ ] All required types defined
- [ ] Types exported for use in other modules

---

#### 1.5 Create Email Client Factory

**New File**: `src/lib/email/client.ts`

**Content**:
```typescript
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
      // Resend client (for future implementation)
      // import { Resend } from 'resend';
      // return new Resend(emailConfig.resend.apiKey);
      throw new Error('Resend not implemented yet');

    default:
      throw new Error(`Unsupported email provider: ${service}`);
  }
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

  try {
    const transporter = createEmailClient();

    const info = await transporter.sendMail({
      from: `${emailConfig.from.name} <${emailConfig.from.email}>`,
      to: Array.isArray(params.to) ? params.to.join(', ') : params.to,
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
```

**Completion Criteria**:
- [ ] File created at `src/lib/email/client.ts`
- [ ] Nodemailer transport configured
- [ ] Error handling implemented
- [ ] Debug logging added
- [ ] Disabled email handling (returns success without sending)

---

#### 1.6 Create Email Templates

**New File**: `src/lib/email/templates.ts`

**Content**:
```typescript
import type { AssessmentEmailData } from './types';

const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

function emailBaseTemplate(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ProofPoint Dashboard</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { border-bottom: 2px solid #0066cc; padding-bottom: 20px; margin-bottom: 20px; }
    .logo { font-size: 24px; font-weight: bold; color: #0066cc; }
    .content { padding: 20px 0; }
    .button { display: inline-block; padding: 12px 24px; background: #0066cc; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
    .button:hover { background: #0052a3; }
    .details { background: #f5f5f5; padding: 15px; border-radius: 4px; margin: 20px 0; }
    .details p { margin: 5px 0; }
    .footer { border-top: 1px solid #ddd; padding-top: 20px; margin-top: 20px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">ProofPoint Dashboard</div>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>This is an automated email from ProofPoint Dashboard.</p>
      <p>Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export const emailTemplates = {
  // Manager notification when staff submits assessment
  assessmentSubmitted: (data: AssessmentEmailData & { managerName: string }): string => {
    const content = `
      <h2>Assessment Submitted for Review</h2>
      <p>Hi ${data.managerName},</p>
      <p><strong>${data.staffName}</strong> has submitted their self-assessment for your review.</p>
      <div class="details">
        <p><strong>Assessment Period:</strong> ${data.period}</p>
        ${data.templateName ? `<p><strong>Framework:</strong> ${data.templateName}</p>` : ''}
      </div>
      <p>Please review the assessment and provide your feedback.</p>
      <a href="${baseUrl}/assessment?id=${data.assessmentId}" class="button">Review Assessment</a>
    `;
    return emailBaseTemplate(content);
  },

  // Director notification when manager completes review
  managerReviewCompleted: (data: AssessmentEmailData & { directorName: string; managerName: string }): string => {
    const content = `
      <h2>Manager Review Completed</h2>
      <p>Hi ${data.directorName},</p>
      <p><strong>${data.managerName}</strong> has completed their review for <strong>${data.staffName}</strong>'s assessment.</p>
      <div class="details">
        <p><strong>Assessment Period:</strong> ${data.period}</p>
        ${data.templateName ? `<p><strong>Framework:</strong> ${data.templateName}</p>` : ''}
        ${data.score ? `<p><strong>Manager Score:</strong> ${data.score}</p>` : ''}
      </div>
      <p>Please review and approve the assessment.</p>
      <a href="${baseUrl}/director?id=${data.assessmentId}" class="button">Review Assessment</a>
    `;
    return emailBaseTemplate(content);
  },

  // Admin notification when director approves
  directorApproved: (data: AssessmentEmailData): string => {
    const content = `
      <h2>Assessment Ready for Release</h2>
      <p>Hi Admin,</p>
      <p>The assessment for <strong>${data.staffName}</strong> has been approved by the director and is ready for release.</p>
      <div class="details">
        <p><strong>Assessment Period:</strong> ${data.period}</p>
        ${data.templateName ? `<p><strong>Framework:</strong> ${data.templateName}</p>` : ''}
        ${data.score ? `<p><strong>Final Score:</strong> ${data.score}</p>` : ''}
        ${data.grade ? `<p><strong>Grade:</strong> ${data.grade}</p>` : ''}
      </div>
      <a href="${baseUrl}/admin?id=${data.assessmentId}" class="button">Release Assessment</a>
    `;
    return emailBaseTemplate(content);
  },

  // Staff notification when admin releases assessment
  adminReleased: (data: AssessmentEmailData): string => {
    const content = `
      <h2>Your Assessment Has Been Released</h2>
      <p>Hi ${data.staffName},</p>
      <p>Your performance assessment for <strong>${data.period}</strong> has been released.</p>
      <div class="details">
        <p><strong>Assessment Period:</strong> ${data.period}</p>
        ${data.templateName ? `<p><strong>Framework:</strong> ${data.templateName}</p>` : ''}
        ${data.score ? `<p><strong>Final Score:</strong> ${data.score}</p>` : ''}
        ${data.grade ? `<p><strong>Grade:</strong> ${data.grade}</p>` : ''}
      </div>
      <p>Please review and acknowledge your assessment.</p>
      <a href="${baseUrl}/assessment?id=${data.assessmentId}" class="button">View & Acknowledge</a>
    `;
    return emailBaseTemplate(content);
  },

  // Staff notification when assessment is returned
  assessmentReturned: (data: AssessmentEmailData & { returnedBy: string; feedback: string }): string => {
    const content = `
      <h2>Assessment Returned for Revision</h2>
      <p>Hi ${data.staffName},</p>
      <p>Your assessment has been returned by <strong>${data.returnedBy}</strong>.</p>
      ${data.feedback ? `
      <div class="details">
        <p><strong>Feedback:</strong></p>
        <p>${data.feedback}</p>
      </div>
      ` : ''}
      <p>Please review the feedback and update your assessment.</p>
      <a href="${baseUrl}/assessment?id=${data.assessmentId}" class="button">Update Assessment</a>
    `;
    return emailBaseTemplate(content);
  },

  // Manager and Director notification when assessment is acknowledged
  assessmentAcknowledged: (data: AssessmentEmailData & { recipientName: string }): string => {
    const content = `
      <h2>Assessment Cycle Completed</h2>
      <p>Hi ${data.recipientName},</p>
      <p><strong>${data.staffName}</strong> has acknowledged their assessment for <strong>${data.period}</strong>.</p>
      <div class="details">
        <p><strong>Assessment Period:</strong> ${data.period}</p>
        ${data.score ? `<p><strong>Final Score:</strong> ${data.score}</p>` : ''}
        ${data.grade ? `<p><strong>Grade:</strong> ${data.grade}</p>` : ''}
      </div>
      <p>The assessment cycle is now complete.</p>
      <a href="${baseUrl}/assessment?id=${data.assessmentId}" class="button">View Assessment</a>
    `;
    return emailBaseTemplate(content);
  },
};

// Template subject lines
export const emailSubjects = {
  assessmentSubmitted: (staffName: string) => `Action Required: ${staffName} submitted assessment for review`,
  managerReviewCompleted: (staffName: string) => `Action Required: Manager review completed for ${staffName}`,
  directorApproved: (staffName: string) => `Action Required: Assessment approved for ${staffName}`,
  adminReleased: () => `Your assessment has been released - Action Required`,
  assessmentReturned: () => `Assessment returned: Please review and resubmit`,
  assessmentAcknowledged: (staffName: string) => `Assessment cycle completed for ${staffName}`,
};
```

**Completion Criteria**:
- [ ] File created at `src/lib/email/templates.ts`
- [ ] All 6 email templates implemented
- [ ] Responsive HTML design with CSS
- [ ] Base URL configuration from environment
- [ ] Action buttons link to correct pages
- [ ] Subject lines exported

---

#### 1.7 Create Email Service Index

**New File**: `src/lib/email/index.ts`

**Content**:
```typescript
export { emailConfig } from './config';
export { createEmailClient, sendEmail } from './client';
export * from './types';
export { emailTemplates, emailSubjects } from './templates';
```

**Completion Criteria**:
- [ ] File created at `src/lib/email/index.ts`
- [ ] All exports consolidated
- [ ] Can import from `@/lib/email`

---

### Phase 1 Completion Checklist
- [ ] Environment variables documented
- [ ] Dependencies installed
- [ ] Email configuration module created
- [ ] Email client factory implemented
- [ ] All email templates created
- [ ] Can send test email (manual verification)

---

## Phase 2: Database Schema Changes

### Objectives
Add database models for notification logging and user preferences.

### Tasks

#### 2.1 Update Prisma Schema

**File**: `prisma/schema.prisma`

**Add the following at the end of the file**:
```prisma
// Email notification log
model Notification {
  id           String              @id @default(uuid())
  assessmentId String?             @map("assessment_id")
  userId       String?             @map("user_id")
  type         NotificationType
  status       NotificationStatus  @default(pending)
  error        String?             @db.Text
  sentAt       DateTime?           @map("sent_at")
  createdAt    DateTime            @default(now()) @map("created_at")

  assessment   Assessment?         @relation(fields: [assessmentId], references: [id], onDelete: SetNull)

  @@index([assessmentId])
  @@index([userId])
  @@index([status])
  @@map("notifications")
}

// User email preferences
model NotificationPreference {
  id                   String   @id @default(uuid())
  userId               String   @unique @map("user_id")
  emailEnabled         Boolean  @default(true) @map("email_enabled")
  assessmentSubmitted  Boolean  @default(true) @map("assessment_submitted")
  managerReviewDone    Boolean  @default(true) @map("manager_review_done")
  directorApproved     Boolean  @default(true) @map("director_approved")
  adminReleased        Boolean  @default(true) @map("admin_released")
  assessmentReturned   Boolean  @default(true) @map("assessment_returned")
  assessmentAcknowledged Boolean @default(true) @map("assessment_acknowledged")
  createdAt            DateTime @default(now()) @map("created_at")
  updatedAt            DateTime @default(now()) @map("updated_at")

  @@index([userId])
  @@map("notification_preferences")
}

// Enums for notification system
enum NotificationType {
  assessment_submitted
  manager_review_completed
  director_approved
  admin_released
  assessment_returned
  assessment_acknowledged
}

enum NotificationStatus {
  pending
  sent
  failed
}
```

**Also update the Assessment model to add the relation**:
```prisma
model Assessment {
  // ... existing fields ...
  questions    AssessmentQuestion[]
  notifications Notification[]  // ADD THIS LINE

  // ... existing ...
}
```

**Completion Criteria**:
- [ ] `Notification` model added to schema
- [ ] `NotificationPreference` model added to schema
- [ ] `NotificationType` enum added
- [ ] `NotificationStatus` enum added
- [ ] Assessment model updated with `notifications` relation
- [ ] No syntax errors in schema file

---

#### 2.2 Create Database Migration

**Command**:
```bash
npx prisma migrate dev --name add_notifications
```

**Completion Criteria**:
- [ ] Migration file created in `prisma/migrations/`
- [ ] Migration applied successfully to local database
- [ ] Tables visible in database
- [ ] `npx prisma generate` completed

---

#### 2.3 Create Seed for Default Preferences

**File**: `prisma/seed-notifications.ts` (or add to existing seed)

**Content**:
```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedNotificationPreferences() {
  // Get all users
  const users = await prisma.user.findMany({
    where: { status: 'active' },
  });

  console.log(`Creating notification preferences for ${users.length} users...`);

  for (const user of users) {
    await prisma.notificationPreference.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        emailEnabled: true,
        assessmentSubmitted: true,
        managerReviewDone: true,
        directorApproved: true,
        adminReleased: true,
        assessmentReturned: true,
        assessmentAcknowledged: true,
      },
    });
  }

  console.log('Notification preferences seeded successfully.');
}

seedNotificationPreferences()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

**Completion Criteria**:
- [ ] Seed file created
- [ ] Can run `tsx prisma/seed-notifications.ts`
- [ ] All existing users get default preferences

---

### Phase 2 Completion Checklist
- [ ] Prisma schema updated
- [ ] Migration created and applied
- [ ] Database tables verified
- [ ] Default preferences seeded for existing users
- [ ] Prisma client regenerated

---

## Phase 3: Notification Service Implementation

### Objectives
Create the notification orchestrator that ties email sending with database logging.

### Tasks

#### 3.1 Create Notification Types

**New File**: `src/lib/notifications/types.ts`

**Content**:
```typescript
import type { NotificationType } from '@prisma/client';

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
  staffName: string;
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
}
```

**Completion Criteria**:
- [ ] File created at `src/lib/notifications/types.ts`
- [ ] All notification types defined

---

#### 3.2 Create Notification Preferences Helper

**New File**: `src/lib/notifications/preferences.ts`

**Content**:
```typescript
import { query, queryOne } from '@/lib/db';
import type { NotificationType } from '@prisma/client';

export interface UserNotificationPreference {
  userId: string;
  emailEnabled: boolean;
  [key: string]: boolean | string; // Index signature for dynamic access
}

export async function getUserNotificationPreference(
  userId: string,
): Promise<UserNotificationPreference | null> {
  const pref = await queryOne<
    UserNotificationPreference & { assessment_submitted: boolean; manager_review_done: boolean; director_approved: boolean; admin_released: boolean; assessment_returned: boolean; assessment_acknowledged: boolean }
  >(
    'SELECT * FROM notification_preferences WHERE user_id = $1',
    [userId],
  );

  if (!pref) {
    // Return default preferences
    return {
      userId,
      emailEnabled: true,
      assessment_submitted: true,
      manager_review_done: true,
      director_approved: true,
      admin_released: true,
      assessment_returned: true,
      assessment_acknowledged: true,
    };
  }

  return pref;
}

export async function isNotificationEnabled(
  userId: string,
  type: NotificationType,
): Promise<boolean> {
  const pref = await getUserNotificationPreference(userId);

  if (!pref || !pref.emailEnabled) {
    return false;
  }

  // Map notification type to column name
  const typeColumns: Record<NotificationType, string> = {
    assessment_submitted: 'assessment_submitted',
    manager_review_completed: 'manager_review_done',
    director_approved: 'director_approved',
    admin_released: 'admin_released',
    assessment_returned: 'assessment_returned',
    assessment_acknowledged: 'assessment_acknowledged',
  };

  return pref[typeColumns[type]] === true;
}

export async function updateUserNotificationPreference(
  userId: string,
  preferences: Partial<Omit<UserNotificationPreference, 'userId'>>,
): Promise<void> {
  const setClauses: string[] = [];
  const values: (boolean | string)[] = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(preferences)) {
    if (key === 'userId') continue;
    setClauses.push(`${key} = $${paramIndex++}`);
    values.push(value);
  }

  if (setClauses.length === 0) return;

  setClauses.push('updated_at = now()');
  values.push(userId);

  await query(
    `INSERT INTO notification_preferences (user_id, ${Object.keys(preferences).filter(k => k !== 'userId').join(', ')})
     VALUES ($1, ${Object.keys(preferences).filter(k => k !== 'userId').map((_, i) => `$${i + 2}`).join(', ')})
     ON CONFLICT (user_id) DO UPDATE
     SET ${setClauses.join(', ')}`,
    [userId, ...Object.values(preferences).filter(v => typeof v !== 'object')],
  );
}
```

**Completion Criteria**:
- [ ] File created at `src/lib/notifications/preferences.ts`
- [ ] `getUserNotificationPreference` function works
- [ ] `isNotificationEnabled` function works
- [ ] `updateUserNotificationPreference` function works
- [ ] Default preferences returned when user has none

---

#### 3.3 Create Assessment Data Fetcher

**New File**: `src/lib/notifications/fetcher.ts`

**Content**:
```typescript
import { queryOne } from '@/lib/db';
import type { AssessmentNotificationData } from './types';

export async function getAssessmentNotificationData(
  assessmentId: string,
): Promise<AssessmentNotificationData | null> {
  const result = await queryOne<
    AssessmentNotificationData & {
      manager_id: string;
      manager_email: string;
      director_id: string;
      director_email: string;
    }
  >(
    `SELECT
      a.id as assessment_id,
      a.period,
      a.final_score,
      a.final_grade,
      rt.name as template_name,
      sp.full_name as staff_name,
      sp.email as staff_email,
      mp.full_name as manager_name,
      mp.email as manager_email,
      mp.user_id as manager_id,
      dp.full_name as director_name,
      dp.email as director_email,
      dp.user_id as director_id,
      a.return_feedback
    FROM assessments a
    LEFT JOIN rubric_templates rt ON a.template_id = rt.id
    LEFT JOIN profiles sp ON a.staff_id = sp.user_id
    LEFT JOIN profiles mp ON a.manager_id = mp.user_id
    LEFT JOIN profiles dp ON a.director_id = dp.user_id
    WHERE a.id = $1`,
    [assessmentId],
  );

  if (!result) return null;

  return {
    assessmentId: result.assessment_id,
    staffName: result.staff_name || 'Staff',
    period: result.period,
    templateName: result.template_name,
    score: result.final_score?.toString(),
    grade: result.final_grade,
    notes: result.return_feedback,
    managerId: result.manager_id,
    managerName: result.manager_name,
    managerEmail: result.manager_email,
    directorId: result.director_id,
    directorName: result.director_name,
    directorEmail: result.director_email,
  };
}
```

**Completion Criteria**:
- [ ] File created at `src/lib/notifications/fetcher.ts`
- [ ] Fetches all required data in single query
- [ ] Returns null if assessment not found
- [ ] Handles null relationships (no manager/director)

---

#### 3.4 Create Notification Logger

**New File**: `src/lib/notifications/logger.ts`

**Content**:
```typescript
import { query, queryOne } from '@/lib/db';
import type { NotificationType, NotificationStatus } from '@prisma/client';

export async function createNotificationLog(params: {
  assessmentId: string;
  userId: string;
  type: NotificationType;
}): Promise<string> {
  const result = await queryOne<{ id: string }>(
    `INSERT INTO notifications (assessment_id, user_id, type, status)
     VALUES ($1, $2, $3, 'pending')
     RETURNING id`,
    [params.assessmentId, params.userId, params.type],
  );

  return result?.id || '';
}

export async function markNotificationSent(
  notificationId: string,
  messageId?: string,
): Promise<void> {
  await query(
    `UPDATE notifications
     SET status = 'sent', sent_at = now()
     WHERE id = $1`,
    [notificationId],
  );
}

export async function markNotificationFailed(
  notificationId: string,
  error: string,
): Promise<void> {
  await query(
    `UPDATE notifications
     SET status = 'failed', error = $1
     WHERE id = $2`,
    [error, notificationId],
  );
}

export async function getPendingNotificationCount(): Promise<number> {
  const result = await queryOne<{ count: bigint }>(
    'SELECT COUNT(*) as count FROM notifications WHERE status = $1',
    ['pending'],
  );
  return Number(result?.count || 0);
}

export async function getFailedNotifications(limit = 50) {
  return query(
    `SELECT n.*, a.period, sp.full_name as staff_name
     FROM notifications n
     LEFT JOIN assessments a ON n.assessment_id = a.id
     LEFT JOIN profiles sp ON a.staff_id = sp.user_id
     WHERE n.status = 'failed'
     ORDER BY n.created_at DESC
     LIMIT $1`,
    [limit],
  );
}
```

**Completion Criteria**:
- [ ] File created at `src/lib/notifications/logger.ts`
- [ ] `createNotificationLog` creates pending notification
- [ ] `markNotificationSent` updates status and timestamp
- [ ] `markNotificationFailed` stores error message
- [ ] `getPendingNotificationCount` returns count
- [ ] `getFailedNotifications` returns failed logs

---

#### 3.5 Create Main Notification Service

**New File**: `src/lib/notifications/index.ts`

**Content**:
```typescript
import { sendEmail, emailSubjects, emailTemplates } from '@/lib/email';
import { isNotificationEnabled } from './preferences';
import { getAssessmentNotificationData } from './fetcher';
import {
  createNotificationLog,
  markNotificationSent,
  markNotificationFailed,
} from './logger';
import type { NotificationType } from '@prisma/client';
import type { NotificationTriggerParams } from './types';

const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

/**
 * Trigger a notification based on assessment status change
 */
export async function triggerNotification(params: NotificationTriggerParams): Promise<void> {
  const { assessmentId, type } = params;

  // Get assessment data
  const data = await getAssessmentNotificationData(assessmentId);
  if (!data) {
    console.error('[Notification] Assessment not found:', assessmentId);
    return;
  }

  // Determine recipients based on notification type
  const recipients = getRecipientsForNotificationType(type, data);

  // Send to each recipient
  for (const recipient of recipients) {
    await sendNotificationToRecipient({
      assessmentId,
      userId: recipient.userId,
      email: recipient.email,
      type,
      data,
    });
  }
}

interface SendNotificationParams {
  assessmentId: string;
  userId: string;
  email: string;
  type: NotificationType;
  data: ReturnType<typeof getAssessmentNotificationData> extends Promise<infer T> ? T : never;
}

async function sendNotificationToRecipient(params: SendNotificationParams): Promise<void> {
  const { assessmentId, userId, email, type, data } = params;

  if (!data) return;

  // Check if notification is enabled for this user
  const enabled = await isNotificationEnabled(userId, type);
  if (!enabled) {
    console.log(`[Notification] Disabled for user ${userId}, type ${type}`);
    return;
  }

  // Create notification log
  const notificationId = await createNotificationLog({
    assessmentId,
    userId,
    type,
  });

  // Generate email content
  const { html, subject } = generateEmailContent(type, data, email);

  // Send email
  const result = await sendEmail({
    to: email,
    subject,
    html,
  });

  // Update notification log
  if (result.success) {
    await markNotificationSent(notificationId, result.messageId);
    console.log(`[Notification] Sent ${type} to ${email}`);
  } else {
    await markNotificationFailed(notificationId, result.error || 'Unknown error');
    console.error(`[Notification] Failed ${type} to ${email}:`, result.error);
  }
}

function getRecipientsForNotificationType(
  type: NotificationType,
  data: NonNullable<Awaited<ReturnType<typeof getAssessmentNotificationData>>>,
): Array<{ userId: string; email: string; name: string }> {
  switch (type) {
    case 'assessment_submitted':
      // Notify manager
      return data.managerId && data.managerEmail
        ? [{ userId: data.managerId, email: data.managerEmail, name: data.managerName || 'Manager' }]
        : [];

    case 'manager_review_completed':
      // Notify director
      return data.directorId && data.directorEmail
        ? [{ userId: data.directorId, email: data.directorEmail, name: data.directorName || 'Director' }]
        : [];

    case 'director_approved':
      // Notify admins (fetch from user_roles)
      return []; // Will be implemented separately - needs admin query

    case 'admin_released':
      // Notify staff
      return [{ userId: data.assessmentId, email: '', name: data.staffName }]; // Email needs to be fetched

    case 'assessment_returned':
      // Notify staff
      return [{ userId: data.assessmentId, email: '', name: data.staffName }]; // Email needs to be fetched

    case 'assessment_acknowledged':
      // Notify manager and director
      const recipients: Array<{ userId: string; email: string; name: string }> = [];
      if (data.managerId && data.managerEmail) {
        recipients.push({ userId: data.managerId, email: data.managerEmail, name: data.managerName || 'Manager' });
      }
      if (data.directorId && data.directorEmail) {
        recipients.push({ userId: data.directorId, email: data.directorEmail, name: data.directorName || 'Director' });
      }
      return recipients;

    default:
      return [];
  }
}

function generateEmailContent(
  type: NotificationType,
  data: NonNullable<Awaited<ReturnType<typeof getAssessmentNotificationData>>>,
  email: string,
): { subject: string; html: string } {
  const baseData = {
    assessmentId: data.assessmentId,
    staffName: data.staffName,
    period: data.period,
    templateName: data.templateName,
    score: data.score,
    grade: data.grade,
    notes: data.notes,
    actionUrl: `${baseUrl}/assessment?id=${data.assessmentId}`,
  };

  switch (type) {
    case 'assessment_submitted':
      return {
        subject: emailSubjects.assessmentSubmitted(data.staffName),
        html: emailTemplates.assessmentSubmitted({
          ...baseData,
          managerName: data.managerName || 'Manager',
        }),
      };

    case 'manager_review_completed':
      return {
        subject: emailSubjects.managerReviewCompleted(data.staffName),
        html: emailTemplates.managerReviewCompleted({
          ...baseData,
          directorName: data.directorName || 'Director',
          managerName: data.managerName || 'Manager',
        }),
      };

    case 'director_approved':
      return {
        subject: emailSubjects.directorApproved(data.staffName),
        html: emailTemplates.directorApproved(baseData),
      };

    case 'admin_released':
      return {
        subject: emailSubjects.adminReleased(),
        html: emailTemplates.adminReleased(baseData),
      };

    case 'assessment_returned':
      return {
        subject: emailSubjects.assessmentReturned(),
        html: emailTemplates.assessmentReturned({
          ...baseData,
          returnedBy: 'Administrator',
          feedback: data.notes || '',
        }),
      };

    case 'assessment_acknowledged':
      return {
        subject: emailSubjects.assessmentAcknowledged(data.staffName),
        html: emailTemplates.assessmentAcknowledged({
          ...baseData,
          recipientName: 'User',
        }),
      };

    default:
      return {
        subject: 'ProofPoint Dashboard Notification',
        html: emailTemplates.adminReleased(baseData),
      };
  }
}
```

**Completion Criteria**:
- [ ] File created at `src/lib/notifications/index.ts`
- [ ] `triggerNotification` function works
- [ ] Recipients determined correctly for each type
- [ ] Email content generated correctly
- [ ] Notification logging implemented
- [ ] Error handling in place

---

### Phase 3 Completion Checklist
- [ ] Notification types defined
- [ ] Preferences helper implemented
- [ ] Assessment data fetcher implemented
- [ ] Notification logger implemented
- [ ] Main notification service implemented
- [ ] End-to-end notification flow works

---

## Phase 4: API Integration

### Objectives
Integrate notification triggers into existing API routes.

### Tasks

#### 4.1 Update Assessments API Route

**File**: `src/app/api/assessments/route.ts`

**Changes**:

1. Add import at top:
```typescript
import { triggerNotification } from '@/lib/notifications';
```

2. In the PUT handler, after the update query succeeds, add notification triggers:

```typescript
// PUT /api/assessments - Update assessment
export async function PUT(request: Request) {
  try {
    // ... existing validation and setup code ...

    // ... existing acknowledgment validation ...

    // Build dynamic update query
    // ... existing update query building code ...

    const updated = await queryOne(
      `UPDATE assessments SET ${setClauses.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
      params,
    );

    // ===== NEW: Trigger notifications =====
    if (updates.status && updated) {
      const newStatus = updates.status;

      // Don't wait for notifications to complete (fire and forget)
      triggerNotification({
        assessmentId: id,
        type: getNotificationTypeForStatus(newStatus),
      }).catch((error) => {
        console.error('[API] Notification trigger failed:', error);
      });
    }
    // ===== END NEW =====

    return NextResponse.json({ data: updated });
  } catch (error) {
    // ... existing error handling ...
  }
}

// Helper function to map status to notification type
function getNotificationTypeForStatus(status: string): NotificationType {
  switch (status) {
    case 'self_submitted':
      return 'assessment_submitted';
    case 'manager_reviewed':
      return 'manager_review_completed';
    case 'director_approved':
      return 'director_approved';
    case 'admin_reviewed':
      return 'admin_released';
    case 'acknowledged':
      return 'assessment_acknowledged';
    case 'rejected':
    case 'returned':
      return 'assessment_returned';
    default:
      return 'assessment_submitted'; // fallback
  }
}
```

**Completion Criteria**:
- [ ] Import added
- [ ] Helper function `getNotificationTypeForStatus` added
- [ ] Notification trigger added after successful update
- [ ] Notifications are fire-and-forget (don't block response)
- [ ] Error handling for notification failures
- [ ] All status transitions trigger correct notification type

---

#### 4.2 Create Notifications API Route

**New File**: `src/app/api/notifications/route.ts`

**Content**:
```typescript
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { getFailedNotifications } from '@/lib/notifications/logger';

// GET /api/notifications - Get user's notifications
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // sent, failed, pending
    const limit = parseInt(searchParams.get('limit') || '50');

    let sql = `
      SELECT n.*,
             a.period,
             sp.full_name as staff_name,
             mp.full_name as manager_name
      FROM notifications n
      LEFT JOIN assessments a ON n.assessment_id = a.id
      LEFT JOIN profiles sp ON a.staff_id = sp.user_id
      LEFT JOIN profiles mp ON a.manager_id = mp.user_id
      WHERE n.user_id = $1
    `;
    const params: unknown[] = [session.user.id];
    let paramIndex = 2;

    if (status) {
      sql += ` AND n.status = $${paramIndex++}`;
      params.push(status);
    }

    sql += ` ORDER BY n.created_at DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const notifications = await query(sql, params);

    return NextResponse.json({ data: notifications });
  } catch (error) {
    console.error('Notifications error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 },
    );
  }
}

// PUT /api/notifications - Update notification preferences
export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { emailEnabled, ...preferences } = body;

    // Build update query
    const setClauses: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (typeof emailEnabled === 'boolean') {
      setClauses.push(`email_enabled = $${paramIndex++}`);
      params.push(emailEnabled);
    }

    for (const [key, value] of Object.entries(preferences)) {
      if (key.endsWith('_email') && typeof value === 'boolean') {
        // For backward compatibility with frontend naming
        const dbField = key.replace('_email', '');
        setClauses.push(`${dbField} = $${paramIndex++}`);
        params.push(value);
      }
    }

    if (setClauses.length > 0) {
      setClauses.push('updated_at = now()');
      params.push(session.user.id);

      await query(
        `INSERT INTO notification_preferences (user_id)
         VALUES ($1)
         ON CONFLICT (user_id) DO UPDATE SET ${setClauses.join(', ')}`,
        [session.user.id, ...params.slice(0, -1)],
      );
    }

    // Fetch and return updated preferences
    const prefs = await queryOne(
      'SELECT * FROM notification_preferences WHERE user_id = $1',
      [session.user.id],
    );

    return NextResponse.json({ data: prefs });
  } catch (error) {
    console.error('Update preferences error:', error);
    return NextResponse.json(
      { error: 'Failed to update preferences' },
      { status: 500 },
    );
  }
}
```

**Completion Criteria**:
- [ ] GET endpoint returns user's notifications
- [ ] PUT endpoint updates preferences
- [ ] Proper authentication check
- [ ] Status filtering works
- [ ] Limit parameter works

---

#### 4.3 Create Admin Notifications API Route

**New File**: `src/app/api/admin/notifications/route.ts`

**Content**:
```typescript
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db';
import { getFailedNotifications } from '@/lib/notifications/logger';

// GET /api/admin/notifications - Get all notifications (admin only)
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin role
    const roles = (session.user as { roles?: string[] }).roles || [];
    if (!roles.includes('admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '100');

    let sql = `
      SELECT n.*,
             a.period,
             sp.full_name as staff_name,
             sp.email as staff_email,
             mp.full_name as manager_name,
             u.email as recipient_email
      FROM notifications n
      LEFT JOIN assessments a ON n.assessment_id = a.id
      LEFT JOIN profiles sp ON a.staff_id = sp.user_id
      LEFT JOIN profiles mp ON a.manager_id = mp.user_id
      LEFT JOIN users u ON n.user_id = u.id
      WHERE 1=1
    `;
    const params: unknown[] = [];
    let paramIndex = 1;

    if (status) {
      sql += ` AND n.status = $${paramIndex++}`;
      params.push(status);
    }

    sql += ` ORDER BY n.created_at DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const notifications = await query(sql, params);

    return NextResponse.json({ data: notifications });
  } catch (error) {
    console.error('Admin notifications error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 },
    );
  }
}

// GET /api/admin/notifications/stats - Notification statistics
export async function GET_STATS(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const roles = (session.user as { roles?: string[] }).roles || [];
    if (!roles.includes('admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const stats = await query(`
      SELECT
        status,
        type,
        COUNT(*) as count
      FROM notifications
      GROUP BY status, type
      ORDER BY status, type
    `);

    return NextResponse.json({ data: stats });
  } catch (error) {
    console.error('Notification stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 },
    );
  }
}
```

**Completion Criteria**:
- [ ] Admin-only access check
- [ ] Lists all notifications
- [ ] Status filtering works
- [ ] Statistics endpoint works

---

### Phase 4 Completion Checklist
- [ ] Assessments API triggers notifications on status change
- [ ] User notifications API route created
- [ ] Admin notifications API route created
- [ ] All notification types trigger correctly
- [ ] Error handling prevents API failures from notification errors

---

## Phase 5: User Interface Implementation

### Objectives
Create UI for notification preferences and admin notification management.

### Tasks

#### 5.1 Create Notification Preferences Page

**New File**: `src/app/settings/notifications/page.tsx`

**Content**:
```typescript
'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface NotificationPreferences {
  emailEnabled: boolean;
  assessment_submitted: boolean;
  manager_review_done: boolean;
  director_approved: boolean;
  admin_released: boolean;
  assessment_returned: boolean;
  assessment_acknowledged: boolean;
}

export default function NotificationPreferencesPage() {
  const { data: session } = useSession();
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    emailEnabled: true,
    assessment_submitted: true,
    manager_review_done: true,
    director_approved: true,
    admin_released: true,
    assessment_returned: true,
    assessment_acknowledged: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const res = await fetch('/api/notifications');
      const data = await res.json();
      if (data.data) {
        setPreferences(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
      });

      if (!res.ok) throw new Error('Failed to save');

      toast.success('Preferences saved successfully');
    } catch (error) {
      toast.error('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const updatePreference = (key: keyof NotificationPreferences, value: boolean) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="container mx-auto py-8 max-w-3xl">
      <h1 className="text-3xl font-bold mb-6">Notification Preferences</h1>

      <Card>
        <CardHeader>
          <CardTitle>Email Notifications</CardTitle>
          <CardDescription>
            Choose which email notifications you want to receive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Master Switch */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Enable Email Notifications</h3>
              <p className="text-sm text-muted-foreground">
                Turn off to disable all email notifications
              </p>
            </div>
            <Switch
              checked={preferences.emailEnabled}
              onCheckedChange={(checked) => updatePreference('emailEnabled', checked)}
            />
          </div>

          {!preferences.emailEnabled && (
            <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded">
              All email notifications are currently disabled.
            </p>
          )}

          {/* Individual Preferences */}
          <div className="space-y-4 pt-4 border-t">
            <PreferenceRow
              label="Assessment Submitted"
              description="When a team member submits an assessment for review"
              checked={preferences.assessment_submitted}
              onChange={(checked) => updatePreference('assessment_submitted', checked)}
              disabled={!preferences.emailEnabled}
            />

            <PreferenceRow
              label="Manager Review Completed"
              description="When a manager completes their review"
              checked={preferences.manager_review_done}
              onChange={(checked) => updatePreference('manager_review_done', checked)}
              disabled={!preferences.emailEnabled}
            />

            <PreferenceRow
              label="Director Approved"
              description="When a director approves an assessment"
              checked={preferences.director_approved}
              onChange={(checked) => updatePreference('director_approved', checked)}
              disabled={!preferences.emailEnabled}
            />

            <PreferenceRow
              label="Assessment Released"
              description="When your assessment is released for acknowledgement"
              checked={preferences.admin_released}
              onChange={(checked) => updatePreference('admin_released', checked)}
              disabled={!preferences.emailEnabled}
            />

            <PreferenceRow
              label="Assessment Returned"
              description="When an assessment is returned for revision"
              checked={preferences.assessment_returned}
              onChange={(checked) => updatePreference('assessment_returned', checked)}
              disabled={!preferences.emailEnabled}
            />

            <PreferenceRow
              label="Assessment Acknowledged"
              description="When an assessment cycle is completed"
              checked={preferences.assessment_acknowledged}
              onChange={(checked) => updatePreference('assessment_acknowledged', checked)}
              disabled={!preferences.emailEnabled}
            />
          </div>

          <div className="pt-4 border-t">
            <Button onClick={savePreferences} disabled={saving}>
              {saving ? 'Saving...' : 'Save Preferences'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PreferenceRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h4 className="font-medium">{label}</h4>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}
```

**Completion Criteria**:
- [ ] Page renders at `/settings/notifications`
- [ ] Fetches current preferences on load
- [ ] Can toggle individual preferences
- [ ] Master switch enables/disables all
- [ ] Save button persists changes
- [ ] Toast notifications for success/error

---

#### 5.2 Create Admin Notification Dashboard

**New File**: `src/components/admin/NotificationDashboard.tsx`

**Content**:
```typescript
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { RefreshCw, AlertCircle, CheckCircle, Clock } from 'lucide-react';

interface NotificationLog {
  id: string;
  type: string;
  status: string;
  created_at: string;
  staff_name?: string;
  period?: string;
  error?: string;
}

interface NotificationStats {
  type: string;
  status: string;
  count: number;
}

export function NotificationDashboard() {
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);
  const [stats, setStats] = useState<NotificationStats[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [filter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [notifRes, statsRes] = await Promise.all([
        fetch(`/api/admin/notifications${filter !== 'all' ? `?status=${filter}` : ''}`),
        fetch('/api/admin/notifications/stats'),
      ]);

      const notifData = await notifRes.json();
      const statsData = await statsRes.json();

      setNotifications(notifData.data || []);
      setStats(statsData.data || []);
    } catch (error) {
      console.error('Failed to fetch notification data:', error);
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'success' | 'destructive'> = {
      sent: 'success',
      failed: 'destructive',
      pending: 'default',
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
  };

  const sentCount = stats.filter(s => s.status === 'sent').reduce((sum, s) => sum + s.count, 0);
  const failedCount = stats.filter(s => s.status === 'failed').reduce((sum, s) => sum + s.count, 0);
  const pendingCount = stats.filter(s => s.status === 'pending').reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Sent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{sentCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{failedCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sentCount + failedCount + pendingCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Notifications List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Notification Logs</CardTitle>
              <CardDescription>View all sent notifications</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex gap-2 mb-4">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              All
            </Button>
            <Button
              variant={filter === 'sent' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('sent')}
            >
              Sent
            </Button>
            <Button
              variant={filter === 'failed' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('failed')}
            >
              Failed
            </Button>
            <Button
              variant={filter === 'pending' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('pending')}
            >
              Pending
            </Button>
          </div>

          {/* List */}
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No notifications found
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(notif.status)}
                    <div>
                      <div className="font-medium">{notif.type.replace(/_/g, ' ')}</div>
                      <div className="text-sm text-muted-foreground">
                        {notif.staff_name} • {notif.period}
                      </div>
                      {notif.error && (
                        <div className="text-sm text-red-600">{notif.error}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(notif.status)}
                    <div className="text-sm text-muted-foreground">
                      {new Date(notif.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

**Completion Criteria**:
- [ ] Dashboard displays notification statistics
- [ ] List of all notifications with status
- [ ] Filter by status (all, sent, failed, pending)
- [ ] Refresh button reloads data
- [ ] Error messages displayed for failed notifications
- [ ] Timestamps formatted correctly

---

#### 5.3 Add Settings Link to Navigation

**File**: `src/components/layout/Header.tsx` (or appropriate navigation component)

**Add settings link**:
```typescript
<Link href="/settings/notifications">
  <Button variant="ghost">Settings</Button>
</Link>
```

**Completion Criteria**:
- [ ] Settings link visible in navigation
- [ ] Link goes to `/settings/notifications`
- [ ] Accessible from all pages

---

### Phase 5 Completion Checklist
- [ ] Notification preferences page created
- [ ] Admin notification dashboard created
- [ ] Settings link added to navigation
- [ ] All UI components use existing design system
- [ ] Responsive design works on mobile
- [ ] Loading states implemented
- [ ] Error handling with toast notifications

---

## Testing Strategy

### Manual Testing Checklist

**Assessment Submitted Notification:**
1. Log in as Staff user
2. Create new assessment
3. Fill in self-assessment scores
4. Submit assessment
5. Verify Manager receives email with correct details
6. Verify notification logged in database with status 'sent'

**Manager Review Notification:**
1. Log in as Manager
2. Open submitted assessment
3. Fill in manager scores and notes
4. Submit review
5. Verify Director receives email
6. Check notification logged correctly

**Director Approval Notification:**
1. Log in as Director
2. Open assessment pending approval
3. Approve assessment
4. Verify Admin receives email

**Admin Release Notification:**
1. Log in as Admin
2. Open approved assessment
3. Release assessment
4. Verify Staff receives email
5. Staff can view and acknowledge

**Assessment Returned Notification:**
1. As Admin, return an assessment
2. Verify Staff receives email with feedback
3. Staff can update and resubmit

**Assessment Acknowledged Notification:**
1. Staff acknowledges released assessment
2. Verify Manager and Director receive completion email

**Notification Preferences:**
1. Go to Settings → Notifications
2. Disable all notifications
3. Submit assessment - verify no emails sent
4. Re-enable specific notification type
5. Verify only that type sends email

**Admin Dashboard:**
1. Go to Admin → Notifications
2. View all notification logs
3. Filter by status
4. View statistics
5. Check failed notifications for errors

---

## Deployment Steps

### Development Setup

```bash
# 1. Install dependencies
npm install nodemailer

# 2. Create Gmail App Password
# - Go to Google Account settings
# - Enable 2FA
# - Generate App Password
# - Add to .env.local

# 3. Configure environment
cp .env.example .env.local
# Edit .env.local with your settings

# 4. Run database migration
npx prisma migrate dev

# 5. Start development server
npm run dev
```

### Production Setup

**GitHub Secrets to Add:**
- `EMAIL_SERVICE` (e.g., "nodemailer" or "resend")
- `EMAIL_FROM` (sender email address)
- `EMAIL_FROM_NAME` (sender name)
- `SMTP_HOST` (for nodemailer)
- `SMTP_PORT` (for nodemailer)
- `SMTP_SECURE` (true/false)
- `SMTP_USER` (SMTP username)
- `SMTP_PASSWORD` (SMTP password or app password)
- `RESEND_API_KEY` (if using Resend)

**Deploy Workflow:**
```bash
# 1. Create feature branch
git checkout -b feature/email-notifications

# 2. Commit and push
git add .
git commit -m "feat: Add email notification system"
git push origin feature/email-notifications

# 3. Create PR and merge

# 4. CI/CD deploys automatically

# 5. Run production migration
npx prisma migrate deploy
```

---

## Estimated Effort by Phase

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| Phase 1 | Email service setup, dependencies, configuration | 2-3 hours |
| Phase 2 | Database schema, migrations, seed data | 1-2 hours |
| Phase 3 | Notification service implementation | 4-6 hours |
| Phase 4 | API integration | 2-3 hours |
| Phase 5 | UI components (preferences page, admin dashboard) | 3-4 hours |
| Testing | Manual testing, bug fixes | 2-3 hours |
| **Total** | | **14-21 hours** |

---

## References

- **API Routes**: `src/app/api/assessments/route.ts`
- **Database Schema**: `prisma/schema.prisma`
- **Environment Variables**: `.env.example`
- **Deployment**: `docker-compose.yml`, `.github/workflows/deploy.yml`
- **Nodemailer Docs**: https://nodemailer.com/
- **Resend Docs**: https://resend.com/docs

---

## Decision Points

Before implementation begins, confirm:

1. **Email Provider**:
   - [ ] Development: Gmail + Nodemailer
   - [ ] Production: Resend or stay with Nodemailer?

2. **From Email Address**:
   - [ ] Use company domain?
   - [ ] Use generic domain?
   - [ ] Use Gmail for development?

3. **Gmail Setup** (if using):
   - [ ] Gmail account configured
   - [ ] 2FA enabled
   - [ ] App Password generated

4. **Testing Strategy**:
   - [ ] Test email recipient(s) identified
   - [ ] Development environment emails enabled/disabled preference

---

*Document Version: 2.0*
*Last Updated: 2026-02-20*
*Author: Claude (AI Assistant)*
