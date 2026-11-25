import assert from 'node:assert/strict';
import { generateKeyPairSync, verify } from 'node:crypto';
import test from 'node:test';
import {
  parseServiceAccount,
  resetEmailClientForTest,
  sendWithGmail,
  serviceAccountAssertion,
} from './client';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const credentials = {
  type: 'service_account',
  client_email: 'proofpoint-mailer@example.iam.gserviceaccount.com',
  private_key: privateKey,
  token_uri: 'https://oauth2.googleapis.com/token',
};

const originalEnv = { ...process.env };

test.afterEach(() => {
  process.env = { ...originalEnv };
  resetEmailClientForTest();
});

test('parseServiceAccount accepts JSON and base64 JSON', () => {
  const json = JSON.stringify(credentials);
  assert.equal(parseServiceAccount(json).client_email, credentials.client_email);
  assert.equal(
    parseServiceAccount(Buffer.from(json).toString('base64')).private_key,
    privateKey,
  );
  assert.throws(
    () => parseServiceAccount('{"type":"service_account"}'),
    /client_email and private_key/,
  );
});

test('serviceAccountAssertion signs the expected delegated Gmail claims', () => {
  const now = 1_800_000_000;
  const assertion = serviceAccountAssertion(
    parseServiceAccount(JSON.stringify(credentials)),
    'no-reply@millennia21.id',
    now,
  );
  const [header, claims, signature] = assertion.split('.');
  const decodedClaims = JSON.parse(
    Buffer.from(claims, 'base64url').toString('utf8'),
  );

  assert.equal(decodedClaims.iss, credentials.client_email);
  assert.equal(decodedClaims.sub, 'no-reply@millennia21.id');
  assert.equal(decodedClaims.scope, 'https://www.googleapis.com/auth/gmail.send');
  assert.equal(decodedClaims.iat, now);
  assert.equal(decodedClaims.exp, now + 3600);
  assert.equal(
    verify(
      'RSA-SHA256',
      Buffer.from(`${header}.${claims}`),
      publicKey,
      Buffer.from(signature, 'base64url'),
    ),
    true,
  );
});

test('sendWithGmail exchanges a token and sends MIME through Gmail API', async () => {
  process.env.GMAIL_CREDENTIALS_JSON = JSON.stringify(credentials);
  process.env.GMAIL_SENDER_EMAIL = 'no-reply@millennia21.id';
  process.env.GMAIL_SENDER_NAME = 'ProofPoint Notifications';

  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fakeFetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = input.toString();
    calls.push({ url, init });
    if (url === credentials.token_uri) {
      return Response.json({ access_token: 'test-token', expires_in: 3600 });
    }
    return Response.json({ id: 'gmail-message-id' });
  }) as typeof fetch;

  const result = await sendWithGmail(
    {
      to: 'asror@millennia21.id',
      subject: 'ProofPoint email test',
      html: '<p>Email delivery works.</p>',
      text: 'Email delivery works.',
    },
    fakeFetch,
  );

  assert.deepEqual(result, { success: true, messageId: 'gmail-message-id' });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].url, 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send');
  assert.equal(
    (calls[1].init?.headers as Record<string, string>).authorization,
    'Bearer test-token',
  );

  const requestBody = JSON.parse(String(calls[1].init?.body)) as { raw: string };
  const mime = Buffer.from(requestBody.raw, 'base64url').toString('utf8');
  assert.match(mime, /From: ProofPoint Notifications <no-reply@millennia21\.id>/);
  assert.match(mime, /To: asror@millennia21\.id/);
  assert.match(mime, /Subject: ProofPoint email test/);
});
