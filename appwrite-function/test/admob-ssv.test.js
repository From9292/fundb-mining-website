'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { parseRawQuery, verifyAdMobSsvCallback } = require('../admob-ssv');

const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});
const nowMs = 1_800_000_000_000;
const fields = [
  'ad_network=5450213213286189855',
  'ad_unit=test-ad-unit',
  'reward_amount=1',
  'reward_item=FUNDB_ACTIVATION',
  'timestamp=' + nowMs,
  'transaction_id=abcdef0123456789abcdef0123456789',
  'user_id=verified-user',
  'custom_data=opaque-session-token'
];

function callback(overrides = {}) {
  const entries = fields.map(x => x);
  const replace = (key, value) => {
    const index = entries.findIndex(x => x.startsWith(key + '='));
    if (index >= 0) entries[index] = key + '=' + value;
    else entries.push(key + '=' + value);
  };
  for (const [key, value] of Object.entries(overrides)) replace(key, String(value));
  const payload = entries.join('&');
  const signature = crypto.sign('sha256', Buffer.from(payload), {
    key: privateKey, dsaEncoding: 'der'
  }).toString('base64url');
  return payload + '&signature=' + signature + '&key_id=77';
}

test('accepts a valid AdMob signature and returns verified callback fields', () => {
  const result = verifyAdMobSsvCallback(callback(), { '77': publicKey }, {
    nowMs, allowedAdUnitIds: ['test-ad-unit'],
    expectedRewardItem: 'FUNDB_ACTIVATION', expectedRewardAmount: 1
  });
  assert.equal(result.provider, 'admob');
  assert.equal(result.transactionId, 'abcdef0123456789abcdef0123456789');
  assert.equal(result.userId, 'verified-user');
  assert.equal(result.customData, 'opaque-session-token');
});

test('rejects a tampered signed parameter', () => {
  const raw = callback().replace('reward_amount=1', 'reward_amount=9');
  assert.throws(() => verifyAdMobSsvCallback(raw, { '77': publicKey }, { nowMs }),
    /SSV_SIGNATURE_INVALID/);
});

test('rejects unknown signing keys', () => {
  assert.throws(() => verifyAdMobSsvCallback(callback(), {}, { nowMs }),
    /SSV_UNKNOWN_KEY_ID/);
});

test('rejects a stale callback even with a valid signature', () => {
  assert.throws(() => verifyAdMobSsvCallback(callback({ timestamp: nowMs - 700_000 }),
    { '77': publicKey }, { nowMs }), /SSV_TIMESTAMP_OUT_OF_RANGE/);
});

test('rejects an unapproved ad unit and unexpected reward configuration', () => {
  assert.throws(() => verifyAdMobSsvCallback(callback(), { '77': publicKey }, {
    nowMs, allowedAdUnitIds: ['production-ad-unit']
  }), /SSV_AD_UNIT_NOT_ALLOWED/);
  assert.throws(() => verifyAdMobSsvCallback(callback(), { '77': publicKey }, {
    nowMs, expectedRewardAmount: 10
  }), /SSV_REWARD_AMOUNT_MISMATCH/);
});

test('rejects duplicate fields and invalid callback ordering', () => {
  assert.throws(() => parseRawQuery(callback() + '&user_id=attacker'),
    /SSV_PARAMETER_ORDER_INVALID/);
  const raw = callback().replace('ad_unit=test-ad-unit', 'ad_unit=test-ad-unit&ad_unit=other');
  assert.throws(() => parseRawQuery(raw), /SSV_DUPLICATE_PARAMETER/);
});

test('rejects malformed signatures', () => {
  const raw = callback().replace(/signature=[^&]+/, 'signature=not*base64');
  assert.throws(() => verifyAdMobSsvCallback(raw, { '77': publicKey }, { nowMs }),
    /SSV_SIGNATURE_INVALID/);
});
