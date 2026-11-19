const https = require('https');
const crypto = require('crypto');
const { URL } = require('url');

const PROJECT_ID = process.env.APPWRITE_FUNCTION_PROJECT_ID;
const DATABASE_ID = process.env.FUNDB_DATABASE_ID || 'fundB_database';
const PROFILE_TABLE_ID = process.env.FUNDB_PROFILE_TABLE_ID || '6aedcd650007f44a070f';
const TRANSACTIONS_TABLE_ID = process.env.FUNDB_TRANSACTIONS_TABLE_ID || 'fundB_transactions';
const API_ENDPOINT = process.env.APPWRITE_FUNCTION_API_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1';
const ALLOWED_ORIGIN = process.env.FUNDB_ALLOWED_ORIGIN || '';

function headers(origin) {
  const h = { 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Appwrite-User-JWT', Vary: 'Origin' };
  if (ALLOWED_ORIGIN && origin === ALLOWED_ORIGIN) h['Access-Control-Allow-Origin'] = origin;
  return h;
}
function send(res, status, payload, origin) { return res.json(payload, status, headers(origin)); }

function appwrite(path, method, requestHeaders, body) {
  return new Promise((resolve, reject) => {
    const base = API_ENDPOINT.replace(/\/+$/, '');
    const route = String(path || '').replace(/^\/+/, '');
    const url = new URL(base + '/' + route);
    const payload = body === undefined ? null : Buffer.from(JSON.stringify(body));
    const req = https.request(url, {
      method,
      headers: { ...requestHeaders, ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': String(payload.length) } : {}) },
      timeout: 15000
    }, response => {
      let raw = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { raw += chunk; });
      response.on('end', () => {
        let data = {};
        try { data = raw ? JSON.parse(raw) : {}; } catch (_) { data = { message: raw }; }
        if (response.statusCode < 200 || response.statusCode >= 300) {
          const err = new Error(data.message || ('Appwrite returned HTTP ' + response.statusCode));
          err.statusCode = response.statusCode;
          err.type = data.type;
          return reject(err);
        }
        resolve(data);
      });
    });
    req.on('timeout', () => req.destroy(new Error('Appwrite request timed out')));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

const tablePath = () => '/tablesdb/' + encodeURIComponent(DATABASE_ID) + '/tables/' + encodeURIComponent(PROFILE_TABLE_ID) + '/rows';
const transactionsPath = () => '/tablesdb/' + encodeURIComponent(DATABASE_ID) + '/tables/' + encodeURIComponent(TRANSACTIONS_TABLE_ID) + '/rows';
async function listUserTransactions(userId, adminHeaders) {
  const queries = [
    { method: 'equal', attribute: 'userId', values: [userId] },
    { method: 'orderDesc', values: ['$createdAt'] },
    { method: 'limit', values: [50] }
  ];
  const query = queries.map(item => 'queries[]=' + encodeURIComponent(JSON.stringify(item))).join('&');
  const result = await appwrite(transactionsPath() + '?' + query, 'GET', adminHeaders);
  return (result.rows || []).map(row => ({
    id: row.$id,
    type: row.type || '',
    amount: Number(row.amount || 0),
    status: row.status || '',
    reference: row.reference || '',
    description: row.description || '',
    createdAt: row.$createdAt || null
  }));
}
const queryUrl = (attribute, value) => {
  const q = [
    { method: 'equal', attribute, values: [value] },
    { method: 'limit', values: [1] }
  ];
  return q.map(item => 'queries[]=' + encodeURIComponent(JSON.stringify(item))).join('&');
};
async function findOne(attribute, value, adminHeaders) {
  const result = await appwrite(tablePath() + '?' + queryUrl(attribute, value), 'GET', adminHeaders);
  return (result.rows || [])[0] || null;
}
async function countFor(attribute, value, adminHeaders) {
  const result = await appwrite(tablePath() + '?' + queryUrl(attribute, value), 'GET', adminHeaders);
  const count = Number(result.total);
  if (!Number.isInteger(count) || count < 0) throw new Error('Appwrite returned an invalid referral count.');
  return count;
}
function newReferralCode() {
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const bytes = crypto.randomBytes(8);
  let suffix = '';
  for (const byte of bytes) suffix += alphabet[byte % alphabet.length];
  return 'FB' + suffix;
}
async function uniqueReferralCode(adminHeaders) {
  for (let i = 0; i < 10; i++) {
    const code = newReferralCode();
    if (!(await findOne('referralCode', code, adminHeaders))) return code;
  }
  throw new Error('Could not allocate a unique referral code.');
}
function parseBody(req) {
  if (req.bodyJson && typeof req.bodyJson === 'object') return req.bodyJson;
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.trim()) {
    try { return JSON.parse(req.body); } catch (_) { return {}; }
  }
  return {};
}
function normalizeCode(value) {
  return String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '');
}

module.exports = async ({ req, res, log, error }) => {
  const origin = (req.headers && req.headers.origin) || '';
  try {
    if (req.method === 'OPTIONS') return res.text('', 204, headers(origin));
    if (req.method !== 'POST') return send(res, 405, { ok: false, message: 'Method not allowed.' }, origin);

    const jwt = req.headers && req.headers['x-appwrite-user-jwt'];
    const functionKey = req.headers && req.headers['x-appwrite-key'];
    if (!PROJECT_ID || !jwt || !functionKey) {
      return send(res, 401, { ok: false, message: 'Missing Appwrite project, signed-in user JWT or function key. Retry from the signed-in FundB website.' }, origin);
    }

    const user = await appwrite('/account', 'GET', {
      'X-Appwrite-Project': PROJECT_ID,
      'X-Appwrite-JWT': jwt
    });
    const body = parseBody(req);
    const action = String(body.action || 'profileSync');
    const adminHeaders = { 'X-Appwrite-Project': PROJECT_ID, 'X-Appwrite-Key': functionKey };

    // Transaction history is read only. Users cannot create, edit or delete ledger rows.
    if (action === 'transactionHistory') {
      const transactions = await listUserTransactions(user.$id, adminHeaders);
      return send(res, 200, { ok: true, transactions, rewardsEnabled: false }, origin);
    }
    if (action !== 'profileSync') {
      return send(res, 400, { ok: false, message: 'Unsupported action.' }, origin);
    }

    const queryCode = req.query && (req.query.ref || req.query.referralCode);
    const submittedCode = normalizeCode(body.referralCode || queryCode);
    const validCode = /^FB[A-Z0-9]{8}$/.test(submittedCode);
    let profile = await findOne('userId', user.$id, adminHeaders);
    let matchedReferrer = false;

    if (!profile) {
      const referrer = validCode ? await findOne('referralCode', submittedCode, adminHeaders) : null;
      const eligibleReferrer = referrer && referrer.userId && referrer.userId !== user.$id ? referrer : null;
      const data = {
        userId: user.$id,
        points: 0,
        referralCode: await uniqueReferralCode(adminHeaders)
      };
      if (eligibleReferrer) {
        data.referred_by = eligibleReferrer.userId;
        matchedReferrer = true;
      }
      try {
        profile = await appwrite(tablePath(), 'POST', adminHeaders, { rowId: user.$id, data });
      } catch (createError) {
        if (createError.statusCode === 409 || createError.type === 'row_already_exists') {
          profile = await findOne('userId', user.$id, adminHeaders);
        }
        if (!profile) throw createError;
      }
    }

    if (!/^FB[A-Z0-9]{8}$/.test(normalizeCode(profile.referralCode))) {
      const repairedCode = await uniqueReferralCode(adminHeaders);
      profile = await appwrite(tablePath() + '/' + encodeURIComponent(profile.$id), 'PATCH', adminHeaders, { data: { referralCode: repairedCode } });
    }

    // A pending invite may be applied once to an existing profile that has no inviter.
    // An established inviter relationship is immutable and cannot be overwritten.
    const currentInviter = String(profile.referred_by || '').trim();
    if (!currentInviter && validCode) {
      const referrer = await findOne('referralCode', submittedCode, adminHeaders);
      if (referrer && referrer.userId && referrer.userId !== user.$id) {
        profile = await appwrite(tablePath() + '/' + encodeURIComponent(profile.$id), 'PATCH', adminHeaders, {
          data: { referred_by: referrer.userId }
        });
        matchedReferrer = true;
      }
    }

    const inviterId = String(profile.referred_by || '').trim();
    const ownReferralCount = await countFor('referred_by', user.$id, adminHeaders);
    // total_referrals is maintained for compatibility when that optional column exists.
    try {
      if (Number(profile.total_referrals || 0) !== ownReferralCount) {
        profile = await appwrite(tablePath() + '/' + encodeURIComponent(profile.$id), 'PATCH', adminHeaders, {
          data: { total_referrals: ownReferralCount }
        });
      }
    } catch (counterError) {
      log('Optional total_referrals field could not be updated; computed count remains available: ' + (counterError.message || 'unknown error'));
    }

    if (inviterId) {
      try {
        const inviter = await findOne('userId', inviterId, adminHeaders);
        if (inviter) {
          const inviterCount = await countFor('referred_by', inviterId, adminHeaders);
          await appwrite(tablePath() + '/' + encodeURIComponent(inviter.$id), 'PATCH', adminHeaders, {
            data: { total_referrals: inviterCount }
          });
        }
      } catch (counterError) {
        log('Inviter counter update failed; referral relationship remains saved: ' + (counterError.message || 'unknown error'));
      }
    }

    const referralLinked = Boolean(profile.referred_by);
    log('FundB profile sync: ' + JSON.stringify({
      userVerified: true,
      referralCodeReceived: Boolean(submittedCode),
      referralCodeFormatValid: validCode,
      referralCodeMatched: matchedReferrer,
      referralLinked,
      totalReferrals: ownReferralCount
    }));

    return send(res, 200, {
      ok: true,
      profile: {
        points: Number(profile.points || 0),
        referralCode: profile.referralCode || 'Not assigned',
        totalReferrals: ownReferralCount,
        referralLinked
      },
      referral: {
        codeReceived: Boolean(submittedCode),
        codeValid: validCode,
        codeMatched: matchedReferrer,
        linked: referralLinked
      },
      rewardsEnabled: false
    }, origin);
  } catch (err) {
    const diagnostic = {
      name: err && err.name,
      message: err && err.message,
      statusCode: err && err.statusCode,
      type: err && err.type,
      endpointConfigured: Boolean(API_ENDPOINT),
      projectConfigured: Boolean(PROJECT_ID)
    };
    error('FundB profile API diagnostic: ' + JSON.stringify(diagnostic));
    return send(res, 500, {
      ok: false,
      message: err && err.message && /referred_by|Unknown attribute|Invalid document structure/i.test(err.message)
        ? 'Referral storage is not configured in the Appwrite Profile table. Confirm that the referred_by string column exists and is indexed.'
        : 'The FundB profile service could not complete the request. Check the Appwrite function execution logs.'
    }, origin);
  }
};
