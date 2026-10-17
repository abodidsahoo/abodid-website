import assert from 'node:assert/strict';
import { randomBytes, scryptSync } from 'node:crypto';
import test from 'node:test';

const salt = randomBytes(16).toString('hex');
const samplePassword = 'local-test-password';
process.env.LAND_VIEWER_PASSWORD_HASH = `scrypt$${salt}$${scryptSync(samplePassword, salt, 64).toString('hex')}`;
process.env.LAND_SESSION_SECRET = randomBytes(48).toString('hex');

const session = await import('../../src/lib/land/session.mjs');

test('viewer password comparison rejects incorrect input', () => {
  assert.equal(session.verifyViewerPassword('incorrect'), false);
  assert.equal(session.verifyViewerPassword(samplePassword), true);
});

test('viewer session is signed, expiring, and rejects tampering', () => {
  const created = session.createViewerSession(false);
  assert.equal(session.verifyViewerSessionToken(created.token), true);
  const tampered = `${created.token.slice(0, -1)}${created.token.endsWith('a') ? 'b' : 'a'}`;
  assert.equal(session.verifyViewerSessionToken(tampered), false);
  assert.ok(created.maxAge <= 12 * 60 * 60);
});

