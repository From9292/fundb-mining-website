const https = require('https');
const { URL } = require('url');

const PROJECT_ID = process.env.APPWRITE_FUNCTION_PROJECT_ID;
const DATABASE_ID = process.env.FUNDB_DATABASE_ID || 'fundB_database';
const PROFILE_TABLE_ID = process.env.FUNDB_PROFILE_TABLE_ID || '6aedcd650007f44a070f';
const API_ENDPOINT = process.env.APPWRITE_FUNCTION_API_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1';
const ALLOWED_ORIGIN = process.env.FUNDB_ALLOWED_ORIGIN || '*';

function responseHeaders(origin) {
  const headers = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Appwrite-User-JWT',
    'Vary': 'Origin'
  };
  // When an origin is configured, only echo that exact trusted website origin.
  // Do not advertise the trusted origin to unrelated browser origins.
  if (ALLOWED_ORIGIN === '*') {
    headers['Access-Control-Allow-Origin'] = '*';
  } else if (origin === ALLOWED_ORIGIN) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

function json(res, statusCode, payload, origin) {
  return res.json(payload, statusCode, responseHeaders(origin));
}

function appwriteRequest(path, method, headers, body) {
  return new Promise((resolve, reject) => {
    // Preserve Appwrite's required /v1 base path. A leading slash passed
    // directly to new URL() would silently discard /v1 and call the wrong URL.
    const base = API_ENDPOINT.replace(/\/+$/, '');
    const route = String(path || '').replace(/^\/+/, '');
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

    // Accept the authenticated user's JWT only from Appwrite's trusted request header.
    // Never accept credentials supplied in the caller-controlled JSON body.
    const jwt = req.headers['x-appwrite-user-jwt'];
    const functionKey = req.headers['x-appwrite-key'];
    // Log presence only. Never log JWTs or API keys.
    log('Auth diagnostics: ' + JSON.stringify({ projectConfigured: Boolean(PROJECT_ID), userJwtPresent: Boolean(jwt), functionKeyPresent: Boolean(functionKey), jwtSource: jwt ? 'header' : 'missing', headerNames: Object.keys(req.headers || {}) }));
    if (!PROJECT_ID || !jwt || !functionKey) {
      const missing = [!PROJECT_ID && 'project configuration', !jwt && 'user JWT header', !functionKey && 'function key header'].filter(Boolean);
      return json(res, 401, { ok: false, message: 'Authentication request is missing: ' + missing.join(', ') + '. Please retry from the signed-in FundB website.' }, origin);
    }

    // Verify the user's short-lived JWT using Appwrite's Account REST endpoint.
    const user = await appwriteRequest('/account', 'GET', {
      'X-Appwrite-Project': PROJECT_ID,
      'X-Appwrite-JWT': jwt
    });

    // A referral code is only considered when creating a brand-new profile.
    // Existing profiles are never retroactively reassigned by a URL parameter.
    let requestBody = {};
    try {
      requestBody = req.bodyJson && typeof req.bodyJson === 'object'
        ? req.bodyJson
        : (typeof req.body === 'string' && req.body ? JSON.parse(req.body) : {});
    } catch (_) {
      requestBody = {};
    }
    const submittedReferralCode = String(requestBody.referralCode || '').trim().toUpperCase();
    const validReferralCodeSubmitted = /^FB[A-Z0-9]{8}$/.test(submittedReferralCode);
    log('Referral request diagnostics: ' + JSON.stringify({ bodyParsed: Boolean(req.bodyJson || req.body), referralCodeSubmitted: Boolean(submittedReferralCode), referralCodeFormatValid: validReferralCodeSubmitted }));

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
    if (profile) {
      log('Existing FundB profile found.');
      // A new account may have had its cloud profile created before the invite
      // code arrived. Allow one-time attribution only while referred_by is empty.
      const existingReferrer = String(profile.referred_by || '').trim();
      if (!existingReferrer && /^FB[A-Z0-9]{8}$/.test(submittedReferralCode)) {
        const referralQuery = [
          { method: 'equal', attribute: 'referralCode', values: [submittedReferralCode] },
          { method: 'limit', values: [1] }
        ];
        const referralQueryString = referralQuery.map(q => 'queries[]=' + encodeURIComponent(JSON.stringify(q))).join('&');
        const referralMatches = await appwriteRequest(tablePath + '?' + referralQueryString, 'GET', adminHeaders);
        const candidate = (referralMatches.rows || [])[0];
        const eligibleReferrer = candidate && candidate.userId && candidate.userId !== user.$id ? candidate : null;
        log('Existing-profile referral lookup: ' + JSON.stringify({ matchingReferrerFound: Boolean(eligibleReferrer), selfReferralRejected: Boolean(candidate && candidate.userId === user.$id) }));
        if (eligibleReferrer) {
          const updatedProfile = await appwriteRequest(
            tablePath + '/' + encodeURIComponent(profile.$id),
            'PATCH', adminHeaders, { data: { referred_by: eligibleReferrer.userId } }
          );
          profile = updatedProfile;
          log('Saved referral attribution on existing profile.');
          try {
            await appwriteRequest(
              tablePath + '/' + encodeURIComponent(eligibleReferrer.$id) + '/total_referrals/increment',
              'PATCH', adminHeaders, { value: 1 }
            );
            log('Recorded one verified profile referral attribution for existing profile.');
          } catch (incrementError) {
            log('Referral attribution saved, but inviter counter increment failed: ' + JSON.stringify({
              statusCode: incrementError && incrementError.statusCode,
              type: incrementError && incrementError.type,
              message: incrementError && incrementError.message
            }));
          }
        }
      } else if (existingReferrer) {
        log('Existing profile already has a referrer; attribution was not changed.');
        if (/^FB[A-Z0-9]{8}$/.test(submittedReferralCode)) {
          const referralQuery = [
            { method: 'equal', attribute: 'referralCode', values: [submittedReferralCode] },
            { method: 'limit', values: [1] }
          ];
          const referralQueryString = referralQuery.map(q => 'queries[]=' + encodeURIComponent(JSON.stringify(q))).join('&');
          const referralMatches = await appwriteRequest(tablePath + '?' + referralQueryString, 'GET', adminHeaders);
          const inviter = (referralMatches.rows || [])[0];
          if (inviter && inviter.userId === existingReferrer && inviter.userId !== user.$id) {
            const referredQuery = [
              { method: 'equal', attribute: 'referred_by', values: [inviter.userId] },
              { method: 'limit', values: [1] }
            ];
            const referredQueryString = referredQuery.map(q => 'queries[]=' + encodeURIComponent(JSON.stringify(q))).join('&');
            const referredRows = await appwriteRequest(tablePath + '?' + referredQueryString, 'GET', adminHeaders);
            const exactReferralCount = Number(referredRows.total);
            if (Number.isInteger(exactReferralCount) && exactReferralCount >= 0) {
              await appwriteRequest(
                tablePath + '/' + encodeURIComponent(inviter.$id),
                'PATCH', adminHeaders, { data: { total_referrals: exactReferralCount } }
              );
              log('Reconciled inviter referral counter from saved referral relationships: ' + JSON.stringify({ relationshipCount: exactReferralCount }));
            } else {
              log('Could not reconcile inviter counter because Appwrite did not return a valid total.');
            }
          } else {
            log('Existing referrer does not match the submitted invite code; no counter changes made.');
          }
        }
      } else {
        log('Existing profile has no referrer and no valid referral code was submitted.');
      }
    } else {
      log('No existing FundB profile found; attempting first-time profile creation.');
    }
    if (!profile) {
      try {
        let referrer = null;
        if (/^FB[A-Z0-9]{8}$/.test(submittedReferralCode)) {
          const referralQuery = [
            { method: 'equal', attribute: 'referralCode', values: [submittedReferralCode] },
            { method: 'limit', values: [1] }
          ];
          const referralQueryString = referralQuery.map(q => 'queries[]=' + encodeURIComponent(JSON.stringify(q))).join('&');
          const referralMatches = await appwriteRequest(tablePath + '?' + referralQueryString, 'GET', adminHeaders);
          const candidate = (referralMatches.rows || [])[0];
          if (candidate && candidate.userId && candidate.userId !== user.$id) referrer = candidate;
          log('Referral lookup result: ' + JSON.stringify({ matchingReferrerFound: Boolean(referrer), selfReferralRejected: Boolean(candidate && candidate.userId === user.$id) }));
        } else {
          log('No valid referral code was submitted for first-time profile creation.');
        }

        const newProfileData = {
          userId: user.$id,
          points: 0,
          referralCode: makeReferralCode(user.$id),
          total_referrals: 0
        };
        if (referrer) newProfileData.referred_by = referrer.userId;

        profile = await appwriteRequest(tablePath, 'POST', adminHeaders, {
          rowId: user.$id,
          data: newProfileData
        });
        log('Created initial FundB profile for authenticated user.');
        log('New profile referral attribution: ' + JSON.stringify({ referredBySaved: Boolean(profile.referred_by || (profile.data && profile.data.referred_by)), referralMatched: Boolean(referrer) }));

        // Atomic counter increment: one increment follows the successful creation
        // of the referred user's unique profile row. No points or bonuses are issued.
        if (referrer) {
          try {
            await appwriteRequest(
              tablePath + '/' + encodeURIComponent(referrer.$id) + '/total_referrals/increment',
              'PATCH', adminHeaders, { value: 1 }
            );
            log('Recorded one verified profile referral attribution.');
          } catch (incrementError) {
            log('Referral attribution saved, but inviter counter increment failed: ' + JSON.stringify({
              statusCode: incrementError && incrementError.statusCode,
              type: incrementError && incrementError.type,
              message: incrementError && incrementError.message
            }));
          }
        }
      } catch (createError) {
        // Preserve the real row-creation error. Looking up the requested row ID
        // here can produce a second 404 and hide the reason the POST failed.
        log('FundB profile row creation failed: ' + JSON.stringify({
          statusCode: createError && createError.statusCode,
          type: createError && createError.type,
          message: createError && createError.message
        }));

        // A concurrent request may have created the profile after our first
        // query. Only retry the userId query for a duplicate-row response.
        if (createError && (createError.statusCode === 409 || createError.type === 'row_already_exists')) {
          const retry = await appwriteRequest(tablePath + '?' + queryString, 'GET', adminHeaders);
          profile = (retry.rows || [])[0];
          if (profile) {
            log('Found FundB profile created by a concurrent request.');
          }
        }

        if (!profile) throw createError;
      }
    }

    return json(res, 200, {
      ok: true,
      profile: {
        points: Number(profile.points || 0),
        referralCode: profile.referralCode || 'Not assigned',
        totalReferrals: Number(profile.total_referrals ?? profile.totalReferrals ?? 0)
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
