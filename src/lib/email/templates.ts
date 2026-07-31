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
    body { font-family: 'Nunito Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #241718; background-color: #FFFAF4; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #FFFFFF; border: 1px solid #D8C9C3; border-radius: 16px; overflow: hidden; box-shadow: 0 12px 30px rgba(36,23,24,0.08); }
    .header { background: #1F2A44; padding: 30px 20px; text-align: center; }
    .logo { font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 28px; font-weight: 800; color: #FFFFFF; margin: 0; }
    .logo span { font-weight: 600; opacity: 0.9; }
    .content { padding: 30px 20px; }
    .greeting { font-size: 16px; color: #5D4B4C; margin: 0 0 10px 0; }
    .message { font-size: 16px; color: #241718; line-height: 1.8; margin: 0 0 20px 0; }
    .highlight { color: #1F2A44; font-weight: 700; }
    .details { background: #E9EDF6; border-left: 4px solid #1F2A44; padding: 20px; margin: 25px 0; border-radius: 12px; }
    .details p { margin: 8px 0; color: #5D4B4C; font-size: 14px; }
    .details strong { color: #241718; display: inline-block; min-width: 120px; }
    .button-container { text-align: center; margin: 30px 0; }
    .button { display: inline-block; padding: 14px 32px; background: #1F2A44; color: #FFFFFF !important; text-decoration: none; border-radius: 12px; margin: 20px 0; font-weight: 700; font-size: 16px; box-shadow: 0 4px 12px rgba(31,42,68,0.18); }
    .button:hover { background: #172035; }
    .footer { background: #FBF2DF; padding: 20px; text-align: center; font-size: 13px; color: #6F6061; border-top: 1px solid #D8C9C3; }
    .footer p { margin: 5px 0; }
    .divider { height: 1px; background: #D8C9C3; margin: 30px 0; }
    h2 { font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1F2A44; font-size: 24px; margin: 0 0 20px 0; font-weight: 800; }
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; margin: 0 !important; }
      .header { padding: 25px 15px !important; }
      .content { padding: 25px 15px !important; }
      .button { padding: 12px 24px !important; font-size: 14px !important; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="logo">ProofPoint</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p style="margin: 0 0 10px 0; font-weight: 800; color: #1F2A44;">ProofPoint</p>
      <p>This is an automated email. Please do not reply.</p>
      <p style="font-size: 11px; margin-top: 10px; color: #6F6061;">© MAD Labs by Millennia World School</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export const emailTemplates = {
  assessmentSubmitted: (data: AssessmentEmailData & { managerName: string }): string => {
    const content = `
      <h2>📋 Assessment Submitted for Review</h2>
      <p class="greeting">Dear ${data.managerName},</p>
      <p class="message"><span class="highlight">${data.staffName}</span> has submitted their self-assessment and is waiting for your review.</p>
      <div class="details">
        <p><strong>Staff Member:</strong> ${data.staffName}</p>
        <p><strong>Assessment Period:</strong> ${data.period}</p>
        ${data.templateName ? `<p><strong>Framework:</strong> ${data.templateName}</p>` : ''}
      </div>
      <div class="button-container">
        <a href="${baseUrl}/assessment?id=${data.assessmentId}" class="button">Review Assessment</a>
      </div>
    `;
    return emailBaseTemplate(content);
  },

  managerReviewCompleted: (data: AssessmentEmailData & { directorName: string; managerName: string }): string => {
    const content = `
      <h2>✅ Manager Review Completed</h2>
      <p class="greeting">Dear ${data.directorName},</p>
      <p class="message"><span class="highlight">${data.managerName}</span> has completed their review for <span class="highlight">${data.staffName}</span>'s assessment.</p>
      <div class="details">
        <p><strong>Staff Member:</strong> ${data.staffName}</p>
        <p><strong>Manager:</strong> ${data.managerName}</p>
        <p><strong>Assessment Period:</strong> ${data.period}</p>
        ${data.templateName ? `<p><strong>Framework:</strong> ${data.templateName}</p>` : ''}
        ${data.score ? `<p><strong>Manager Score:</strong> ${data.score}</p>` : ''}
      </div>
      <div class="button-container">
        <a href="${baseUrl}/director?id=${data.assessmentId}" class="button">Review Assessment</a>
      </div>
    `;
    return emailBaseTemplate(content);
  },

  directorApproved: (data: AssessmentEmailData): string => {
    const content = `
      <h2>🎯 Assessment Ready for Release</h2>
      <p class="greeting">Dear Admin,</p>
      <p class="message">The assessment for <span class="highlight">${data.staffName}</span> has been approved by the director and is ready for release to the staff member.</p>
      <div class="details">
        <p><strong>Staff Member:</strong> ${data.staffName}</p>
        <p><strong>Assessment Period:</strong> ${data.period}</p>
        ${data.templateName ? `<p><strong>Framework:</strong> ${data.templateName}</p>` : ''}
        ${data.score ? `<p><strong>Final Score:</strong> ${data.score}</p>` : ''}
        ${data.grade ? `<p><strong>Grade:</strong> ${data.grade}</p>` : ''}
      </div>
      <div class="button-container">
        <a href="${baseUrl}/admin?id=${data.assessmentId}" class="button">Release Assessment</a>
      </div>
    `;
    return emailBaseTemplate(content);
  },

  adminReleased: (data: AssessmentEmailData): string => {
    const content = `
      <h2>🎉 Your Assessment Results Are Available!</h2>
      <p class="greeting">Dear ${data.staffName},</p>
      <p class="message">Great news! Your performance assessment for <span class="highlight">${data.period}</span> has been finalized and is now available for you to view.</p>
      <div class="details">
        <p><strong>Assessment Period:</strong> ${data.period}</p>
        ${data.templateName ? `<p><strong>Framework:</strong> ${data.templateName}</p>` : ''}
        ${data.score ? `<p><strong>Final Score:</strong> ${data.score}</p>` : ''}
        ${data.grade ? `<p><strong>Performance Grade:</strong> ${data.grade}</p>` : ''}
      </div>
      <div class="button-container">
        <a href="${baseUrl}/assessment?id=${data.assessmentId}" class="button">View & Acknowledge Results</a>
      </div>
    `;
    return emailBaseTemplate(content);
  },

  assessmentReturned: (data: AssessmentEmailData & { returnedBy: string; feedback: string }): string => {
    const content = `
      <h2>📝 Assessment Returned for Revision</h2>
      <p class="greeting">Dear ${data.staffName},</p>
      <p class="message">Your assessment has been returned by <span class="highlight">${data.returnedBy}</span> for further review and updates.</p>
      ${data.feedback ? `
      <div class="details">
        <p><strong>Feedback:</strong></p>
        <p style="font-style: italic; color: #5D4B4C;">"${data.feedback}"</p>
      </div>
      ` : ''}
      <div class="button-container">
        <a href="${baseUrl}/assessment?id=${data.assessmentId}" class="button">Update Assessment</a>
      </div>
    `;
    return emailBaseTemplate(content);
  },

  assessmentAcknowledged: (data: AssessmentEmailData & { recipientName: string }): string => {
    const content = `
      <h2>✨ Assessment Cycle Completed</h2>
      <p class="greeting">Dear ${data.recipientName},</p>
      <p class="message"><span class="highlight">${data.staffName}</span> has successfully acknowledged their assessment for <span class="highlight">${data.period}</span>.</p>
      <div class="details">
        <p><strong>Staff Member:</strong> ${data.staffName}</p>
        <p><strong>Assessment Period:</strong> ${data.period}</p>
        ${data.score ? `<p><strong>Final Score:</strong> ${data.score}</p>` : ''}
        ${data.grade ? `<p><strong>Grade:</strong> ${data.grade}</p>` : ''}
      </div>
      <div class="divider"></div>
      <p style="text-align: center; color: #486142; font-weight: 700;">✓ Assessment cycle successfully completed</p>
    `;
    return emailBaseTemplate(content);
  },
};

export const emailSubjects = {
  assessmentSubmitted: (staffName: string) => `📋 Action Required: ${staffName}'s assessment awaits your review`,
  managerReviewCompleted: (staffName: string) => `✅ Review Complete: ${staffName}'s assessment ready for director approval`,
  directorApproved: (staffName: string) => `🎯 Ready to Release: ${staffName}'s assessment awaits your approval`,
  adminReleased: () => `🎉 Your Assessment Results Are Available - Action Required`,
  assessmentReturned: () => `📝 Your assessment needs revision - Action Required`,
  assessmentAcknowledged: (staffName: string) => `✨ Assessment Complete: ${staffName} has acknowledged their review`,
};
