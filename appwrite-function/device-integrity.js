'use strict';

const crypto = require('node:crypto');

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;
const MAX_SIGNALS = 20;
const ALLOWED_SIGNALS = new Set([
  'repeated_installation_pairing',
  'signup_burst',
  'duplicate_mission_attempt',
  'referral_abuse_pattern',
  'token_replay'
]);

function validateInstallationToken(token) {
  return typeof token === 'string' && TOKEN_PATTERN.test(token);
}

function digestInstallationToken(token, secret) {
  if (!validateInstallationToken(token)) {
    throw new TypeError('INSTALLATION_TOKEN_INVALID');
  }
  if (typeof secret !== 'string' || Buffer.byteLength(secret, 'utf8') < 32) {
    throw new TypeError('DEVICE_HMAC_SECRET_INVALID');
  }
  return crypto.createHmac('sha256', secret).update(token, 'utf8').digest('hex');
}

function assessIntegritySignals(signals) {
  if (!Array.isArray(signals) || signals.length > MAX_SIGNALS) {
    throw new TypeError('INTEGRITY_SIGNALS_INVALID');
  }
  const accepted = signals.filter(signal =>
    typeof signal === 'string' && ALLOWED_SIGNALS.has(signal)
  );
  const unique = [...new Set(accepted)];
  const weights = {
    repeated_installation_pairing: 15,
    signup_burst: 20,
    duplicate_mission_attempt: 25,
    referral_abuse_pattern: 30,
    token_replay: 35
  };
  const score = Math.min(100, unique.reduce((total, signal) => total + weights[signal], 0));
  return Object.freeze({
    mode: 'monitor_only',
    score,
    signals: unique,
    decision: 'allow_and_monitor',
    accountRestriction: false,
    deleteAccount: false
  });
}

module.exports = {
  validateInstallationToken,
  digestInstallationToken,
  assessIntegritySignals
};
