'use strict';

// Pure AdMob SSV verifier. This module deliberately does not write rewards.
// The caller must supply trusted, recently refreshed Google public keys and
// must persist transaction_id idempotently before any reward can be granted.
const crypto = require('node:crypto');

const REQUIRED = [
  'ad_network', 'ad_unit', 'key_id', 'reward_amount',
  'reward_item', 'signature', 'timestamp', 'transaction_id'
];

function decodeBase64Url(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new TypeError('SSV_SIGNATURE_INVALID');
  }
  return Buffer.from(value, 'base64url');
}

function parseRawQuery(rawQuery) {
  if (typeof rawQuery !== 'string' || rawQuery.length < 1 || rawQuery.length > 8192) {
    throw new TypeError('SSV_QUERY_INVALID');
  }
  const query = rawQuery.startsWith('?') ? rawQuery.slice(1) : rawQuery;
  const pairs = query.split('&');
  if (pairs.length < REQUIRED.length) throw new TypeError('SSV_FIELDS_MISSING');

  // Google's documented callback format places signature and key_id last,
  // in that order. Preserve every preceding byte exactly for verification.
  const signaturePair = pairs[pairs.length - 2];
  const keyIdPair = pairs[pairs.length - 1];
  if (!signaturePair.startsWith('signature=') || !keyIdPair.startsWith('key_id=')) {
    throw new TypeError('SSV_PARAMETER_ORDER_INVALID');
  }
  const signedPayload = pairs.slice(0, -2).join('&');
  const fields = Object.create(null);
  for (const pair of pairs) {
    const split = pair.indexOf('=');
    if (split <= 0) throw new TypeError('SSV_QUERY_INVALID');
    const key = decodeURIComponent(pair.slice(0, split).replace(/\+/g, ' '));
    const value = pair.slice(split + 1);
    if (Object.prototype.hasOwnProperty.call(fields, key)) {
      throw new TypeError('SSV_DUPLICATE_PARAMETER');
    }
    fields[key] = value;
  }
  for (const name of REQUIRED) {
    if (typeof fields[name] !== 'string' || fields[name].length === 0) {
      throw new TypeError('SSV_FIELDS_MISSING');
    }
  }
  const signature = decodeBase64Url(fields.signature);
  const keyId = fields.key_id;
  if (!/^\d{1,20}$/.test(keyId)) throw new TypeError('SSV_KEY_ID_INVALID');
  return { fields, signedPayload, signature, keyId };
}

function verifyAdMobSsvCallback(rawQuery, publicKeys, options = {}) {
  const parsed = parseRawQuery(rawQuery);
  if (!publicKeys || typeof publicKeys !== 'object') {
    throw new TypeError('SSV_TRUSTED_KEYS_UNAVAILABLE');
  }
  const publicKey = publicKeys[parsed.keyId];
  if (typeof publicKey !== 'string' || !publicKey.includes('BEGIN PUBLIC KEY')) {
    throw new TypeError('SSV_UNKNOWN_KEY_ID');
  }

  const valid = crypto.verify(
    'sha256',
    Buffer.from(parsed.signedPayload, 'utf8'),
    { key: publicKey, dsaEncoding: 'der' },
    parsed.signature
  );
  if (!valid) throw new TypeError('SSV_SIGNATURE_INVALID');

  // Trust no callback fields until after signature verification.
  const f = parsed.fields;
  const timestamp = Number(f.timestamp);
  const rewardAmount = Number(f.reward_amount);
  const nowMs = Number.isFinite(options.nowMs) ? options.nowMs : Date.now();
  const maxAgeMs = Number.isSafeInteger(options.maxAgeMs) ? options.maxAgeMs : 10 * 60 * 1000;
  if (!Number.isSafeInteger(timestamp) || timestamp <= 0 ||
      timestamp > nowMs + 60_000 || nowMs - timestamp > maxAgeMs) {
    throw new TypeError('SSV_TIMESTAMP_OUT_OF_RANGE');
  }
  if (!/^\d+$/.test(f.reward_amount) || !Number.isSafeInteger(rewardAmount) || rewardAmount <= 0) {
    throw new TypeError('SSV_REWARD_AMOUNT_INVALID');
  }
  if (!/^[A-Fa-f0-9]{16,128}$/.test(f.transaction_id)) {
    throw new TypeError('SSV_TRANSACTION_ID_INVALID');
  }
  if (options.allowedAdUnitIds &&
      !options.allowedAdUnitIds.includes(f.ad_unit)) {
    throw new TypeError('SSV_AD_UNIT_NOT_ALLOWED');
  }
  if (options.expectedRewardItem && f.reward_item !== options.expectedRewardItem) {
    throw new TypeError('SSV_REWARD_ITEM_MISMATCH');
  }
  if (options.expectedRewardAmount !== undefined &&
      rewardAmount !== options.expectedRewardAmount) {
    throw new TypeError('SSV_REWARD_AMOUNT_MISMATCH');
  }

  return Object.freeze({
    provider: 'admob',
    transactionId: f.transaction_id,
    adUnitId: f.ad_unit,
    adNetwork: f.ad_network,
    rewardAmount,
    rewardItem: decodeURIComponent(f.reward_item.replace(/\+/g, ' ')),
    timestamp,
    userId: f.user_id ? decodeURIComponent(f.user_id.replace(/\+/g, ' ')) : null,
    customData: f.custom_data ? decodeURIComponent(f.custom_data.replace(/\+/g, ' ')) : null,
    keyId: parsed.keyId
  });
}

module.exports = { parseRawQuery, verifyAdMobSsvCallback };
