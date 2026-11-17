const https = require('https');
const { URL } = require('url');

const PROJECT_ID = process.env.APPWRITE_FUNCTION_PROJECT_ID;
const DATABASE_ID = process.env.FUNDB_DATABASE_ID || 'fundB_database';
const PROFILE_TABLE_ID = process.env.FUNDB_PROFILE_TABLE_ID || '6aedcd650007f44a070f';
const API_ENDPOINT = process.env.APPWRITE_FUNCTION_API_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1';
const ALLOWED_ORIGIN = process.env.FUNDB_ALLOWED_ORIGIN || '*';

function responseHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN === '*' ? '*' : (origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Appwrite-User-JWT',
    'Vary': 'Origin'
  };
}

function json(res, statusCode, payload, origin) {
  return res.json(payload, statusCode, responseHeaders(origin));
}

function appwriteRequest(path, method, headers, body) {
  return new Promise((resolve, reject) => {
    // Preserve Appwrite's required /v1 base path. A leading slash passed
    // directly to new URL() would silently discard /v1 and call the wrong URL.
    const base = API_ENDPOINT.replace(/\\/+$/, '');
    const route = String(path || '').replace(/^\\/+/, '');
    const url = new URL(base + '/' + route);
    const payload = body === undefined ? null : Buffer.from(JSON.stringify(body));
    const request = https.request(url, {
      method,
      headers: {
        ...headers,
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': String(payload.length) } : {})
      },
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
    request.on('timeout', () => request.destroy(new Error('Appwrite request timed out')));
    request.on('error', reject);
    if (payload) request.write(payload);
    request.end();
  });
}

function makeReferralCode(userId) {
  return 'FB' + userId.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase();
}

module.exports = async ({ req, res, log, error }) => {
  try {
    const origin = req.headers.origin || '';
    if (req.method === 'OPTIONS') {
      return res.text('', 204, responseHeaders(origin));
    }
    if (req.method !== 'POST') {
      return json(res, 405, { ok: false, message: 'Method not allowed.' }, origin);
    }

    const jwt = req.headers['x-appwrite-user-jwt'] || (req.bodyJson && (req.bodyJson.userJwt || req.bodyJson.jwt));
    const functionKey = req.headers['x-appwrite-key'];
    // Log presence only. Never log JWTs or API keys.
    log('Auth diagnostics: ' + JSON.stringify({ projectConfigured: Boolean(PROJECT_ID), userJwtPresent: Boolean(jwt), functionKeyPresent: Boolean(functionKey), jwtSource: req.headers['x-appwrite-user-jwt'] ? 'header' : (jwt ? 'request-body' : 'missing'), headerNames: Object.keys(req.headers || {}) }));
    if (!PROJECT_ID || !jwt || !functionKey) {
      const missing = [!PROJECT_ID && 'project configuration', !jwt && 'user JWT header', !functionKey && 'function key header'].filter(Boolean);
      return json(res, 401, { ok: false, message: 'Authentication request is missing: ' + missing.join(', ') + '. Please retry from the signed-in FundB website.' }, origin);
    }

    // Verify the user's short-lived JWT using Appwrite's Account REST endpoint.
    const user = await appwriteRequest('/account', 'GET', {
      'X-Appwrite-Project': PROJECT_ID,
      'X-Appwrite-JWT': jwt
    });

    // Use the function's server-side key only after verifying the caller.
    const tablePath = '/tablesdb/' + encodeURIComponent(DATABASE_ID) +
      '/tables/' + encodeURIComponent(PROFILE_TABLE_ID) + '/rows';
    const queryList = [
      { method: 'equal', attribute: 'userId', values: [user.$id] },
      { method: 'limit', values: [1] }
    ];
    const queryString = queryList.map(q => 'queries[]=' + encodeURIComponent(JSON.stringify(q))).join('&');
    const adminHeaders = {
      'X-Appwrite-Project': PROJECT_ID,
      'X-Appwrite-Key': functionKey
    };
    const found = await appwriteRequest(tablePath + '?' + queryString, 'GET', adminHeaders);

    let profile = (found.rows || [])[0];
    if (!profile) {
      try {
        profile = await appwriteRequest(tablePath, 'POST', adminHeaders, {
          rowId: user.$id,
          data: {
            userId: user.$id,
            points: 0,
            referralCode: makeReferralCode(user.$id)
          }
        });
        log('Created initial FundB profile for authenticated user.');
      } catch (createError) {
        profile = await appwriteRequest(tablePath + '/' + encodeURIComponent(user.$id), 'GET', adminHeaders);
        if (!profile) throw createError;
      }
    }

    return json(res, 200, {
      ok: true,
      profile: {
        points: Number(profile.points || 0),
        referralCode: profile.referralCode || 'Not assigned',
        totalReferrals: Number(profile.totalReferrals || 0)
      },
      rewardsEnabled: false
    }, origin);
  } catch (err) {
    // Capture the network failure reason without logging credentials or JWTs.
    const diagnostic = {
      name: err && err.name,
      message: err && err.message,
      causeName: err && err.cause && err.cause.name,
      causeCode: err && err.cause && err.cause.code,
      causeMessage: err && err.cause && err.cause.message,
      stack: err && err.stack ? String(err.stack).split('\\n').slice(0, 8).join(' | ') : undefined,
      endpointConfigured: Boolean(API_ENDPOINT),
      projectConfigured: Boolean(PROJECT_ID)
    };
    error('FundB profile API diagnostic: ' + JSON.stringify(diagnostic));
    return json(res, 500, { ok: false, message: 'The FundB profile service could not reach Appwrite. Diagnostic details are recorded in the function execution logs.' }, req.headers.origin || '');
  }
};
