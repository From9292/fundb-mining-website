'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  validateInstallationToken,
  digestInstallationToken,
  assessIntegritySignals
} = require('../device-integrity');

const secret = 'test-only-secret-that-is-at-least-32-bytes';

test('accepts bounded opaque base64url installation tokens only', () => {
  assert.equal(validateInstallationToken('a'.repeat(32)), true);
  assert.equal(validateInstallationToken('a'.repeat(128)), true);
  assert.equal(validateInstallationToken('short'), false);
  assert.equal(validateInstallationToken('a'.repeat(129)), false);
  assert.equal(validateInstallationToken('a'.repeat(31) + '!'), false);
  assert.equal(validateInstallationToken(null), false);
});

test('HMAC digest is deterministic and never returns the raw token', () => {
  const token = 'A'.repeat(43);
  const digest = digestInstallationToken(token, secret);
  assert.match(digest, /^[a-f0-9]{64}$/);
  assert.notEqual(digest, token);
  assert.equal(digestInstallationToken(token, secret), digest);
  assert.notEqual(digestInstallationToken(token, secret + 'x'), digest);
});

test('rejects invalid token and weak secret', () => {
  assert.throws(() => digestInstallationToken('bad', secret), /INSTALLATION_TOKEN_INVALID/);
  assert.throws(() => digestInstallationToken('A'.repeat(43), 'weak'), /DEVICE_HMAC_SECRET_INVALID/);
});

test('scores only known signals and always remains monitor-only', () => {
  const result = assessIntegritySignals([
    'signup_burst',
    'referral_abuse_pattern',
    'unknown_client_claim',
    'signup_burst'
  ]);
  assert.equal(result.score, 50);
  assert.deepEqual(result.signals, ['signup_burst', 'referral_abuse_pattern']);
  assert.equal(result.mode, 'monitor_only');
  assert.equal(result.decision, 'allow_and_monitor');
  assert.equal(result.accountRestriction, false);
  assert.equal(result.deleteAccount, false);
});

test('caps scores and rejects oversized signal arrays', () => {
  const result = assessIntegritySignals([
    'repeated_installation_pairing',
    'signup_burst',
    'duplicate_mission_attempt',
    'referral_abuse_pattern',
    'token_replay'
  ]);
  assert.equal(result.score, 100);
  assert.throws(() => assessIntegritySignals(new Array(21).fill('signup_burst')), /INTEGRITY_SIGNALS_INVALID/);
});
