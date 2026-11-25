import { sendEmail } from '../src/lib/email/client';

const recipient = process.argv[2];
if (!recipient) {
  throw new Error('Usage: tsx scripts/send-test-email.ts recipient@example.com');
}

const sentAt = new Date().toISOString();
const result = await sendEmail({
  to: recipient,
  subject: 'ProofPoint Gmail integration test',
  text: `ProofPoint Gmail service-account delivery is working. Sent at ${sentAt}.`,
  html: [
    '<h2>ProofPoint email delivery is working</h2>',
    '<p>This message was sent through the Gmail API using the configured service account.</p>',
    `<p>Sent at: <strong>${sentAt}</strong></p>`,
  ].join(''),
});

if (!result.success) {
  throw new Error(result.error || 'Email delivery failed');
}

console.log(`Email sent to ${recipient}. Message ID: ${result.messageId || 'not returned'}`);
