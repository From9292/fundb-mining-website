const https = require('https');
const crypto = require('crypto');
const { URL } = require('url');

const PROJECT_ID = process.env.APPWRITE_FUNCTION_PROJECT_ID;
const DATABASE_ID = process.env.FUNDB_DATABASE_ID || '6aedcd650007f44a070f';
const PROFILE_TABLE_ID = process.env.FUNDB_PROFILE_TABLE_ID || 'profile';
const API_ENDPOINT = process.env.APPWRITE_FUNCTION_API_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1';
const ALLOWED_ORIGINS = new Set(
  (process.env.FUNDB_ALLOWED_ORIGIN ||
    'https://cosmic-cupcake-cc56c4.netlify.app,https://fundb-production-hardening.fundb-mining-website.pages.dev,https://fundb-public-content-legal.fundb-mining-website.pages.dev')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean)
);

function responseHeaders(origin) {
  const headers = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Appwrite-User-JWT',
    'Vary': 'Origin'
  };
  // When an origin is configured, only echo that exact trusted website origin.
  // Do not advertise the trusted origin to unrelated browser origins.
  if (ALLOWED_ORIGINS.has(origin)) {
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

function makeReferralCode() {
  // Generate an unpredictable 8-character code; do not derive it from user IDs.
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const bytes = crypto.randomBytes(8);
  let suffix = '';
  for (const byte of bytes) suffix += alphabet[byte % alphabet.length];
  return 'FB' + suffix;
}

async function createUniqueReferralCode(tablePath, adminHeaders) {
  // Check the existing indexed referralCode field before assigning a new code.
  // Retry on the extraordinarily unlikely collision; never overwrite an existing code.
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = makeReferralCode();
    const query = [
      { method: 'equal', attribute: 'referralCode', values: [candidate] },
      { method: 'limit', values: [1] }
    ];
    const queryString = query.map(q => 'queries[]=' + encodeURIComponent(JSON.stringify(q))).join('&');
    const matches = await appwriteRequest(tablePath + '?' + queryString, 'GET', adminHeaders);
    if (!(matches.rows || []).length) return candidate;
  }
  throw new Error('Could not allocate a unique referral code after several attempts.');
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
    if (requestBody.action === 'transactionHistory') {
      // Transaction storage is not wired to this function yet. Fail explicitly
      // rather than returning a fake empty history that could mislead users.
      return json(res, 501, {
        ok: false,
        code: 'TRANSACTION_HISTORY_NOT_CONFIGURED',
        message: 'Transaction history is not connected yet. No rewards, deposits or withdrawals are active.'
      }, origin);
    }

    const submittedReferralCode = String(requestBody.referralCode || '').trim().toUpperCase();
    const validReferralCodeSubmitted = /^FB[A-Z0-9]{8}$/.test(submittedReferralCode);
    log('Referral request diagnostics: ' + JSON.stringify({ bodyParsed: Boolean(req.bodyJson || req.body), referralCodeSubmitted: Boolean(submittedReferralCode), referralCodeFormatValid: validReferralCodeSubmitted }));

    // Use the function's server-side key only after verifying the caller.
    const queryList = [
      { method: 'equal', attribute: 'userId', values: [user.$id] },
      { method: 'limit', values: [1] }
    ];
    const queryString = queryList.map(q => 'queries[]=' + encodeURIComponent(JSON.stringify(q))).join('&');
    const adminHeaders = {
      'X-Appwrite-Project': PROJECT_ID,
      'X-Appwrite-Key': functionKey
    };

    // Both mappings appeared in earlier FundB setup records. Probe the known
    // pairs and prefer the one that already contains this user's saved profile.
    // This prevents a wrong default from creating duplicate profiles elsewhere.
    const knownDatabaseIds = ['6aedcd650007f44a070f', 'fundBdatabase', 'fundB_database'];
    const knownProfileTableIds = [
      '6afea0720025daaed040',
      '6afbee8500163626863a',
      '6afd028f002b30f3902b'
    ];
    // Probe the three supplied table IDs against each previously recorded
    // database identifier. This is read-only discovery until a matching
    // existing profile is found; never create a profile in an ambiguous table.
    const tableCandidates = [
      { databaseId: DATABASE_ID, tableId: PROFILE_TABLE_ID },
      ...knownDatabaseIds.flatMap(databaseId =>
        knownProfileTableIds.map(tableId => ({ databaseId, tableId }))
      ),
      { databaseId: 'fundBdatabase', tableId: '6aedcd650007f44a070f' },
      { databaseId: 'fundB_database', tableId: '6aedcd650007f44a070f' }
    ];
    const uniqueCandidates = tableCandidates.filter((candidate, index, all) =>
      all.findIndex(item => item.databaseId === candidate.databaseId && item.tableId === candidate.tableId) === index
    );
    const validTables = [];
    const candidateDiagnostics = [];
    let lastTableError = null;
    for (const candidate of uniqueCandidates) {
      const candidatePath = '/tablesdb/' + encodeURIComponent(candidate.databaseId) +
        '/tables/' + encodeURIComponent(candidate.tableId) + '/rows';
      try {
        const candidateRows = await appwriteRequest(candidatePath + '?' + queryString, 'GET', adminHeaders);
        const anyRowsQuery = 'queries[]=' + encodeURIComponent(JSON.stringify({ method: 'limit', values: [1] }));
        const existingRows = await appwriteRequest(candidatePath + '?' + anyRowsQuery, 'GET', adminHeaders);
        const candidateResult = {
          databaseId: candidate.databaseId,
          tableId: candidate.tableId,
          tablePath: candidatePath,
          profile: (candidateRows.rows || [])[0] || null,
          hasExistingRows: (existingRows.rows || []).length > 0
        };
        validTables.push(candidateResult);
        candidateDiagnostics.push({
          databaseId: candidate.databaseId,
          tableId: candidate.tableId,
          status: 'reachable',
          matchingProfile: Boolean(candidateResult.profile),
          hasRows: candidateResult.hasExistingRows
        });
      } catch (candidateError) {
        lastTableError = candidateError;
        candidateDiagnostics.push({
          databaseId: candidate.databaseId,
          tableId: candidate.tableId,
          status: Number(candidateError && candidateError.statusCode) || null,
          type: candidateError && candidateError.type ? String(candidateError.type).slice(0, 80) : null,
          message: candidateError && candidateError.message ? String(candidateError.message).slice(0, 140) : 'Unknown lookup error'
        });
        if (candidateError && candidateError.statusCode === 404) {
          log('FundB table candidate not found; safely trying the other known mapping: ' + JSON.stringify({
            databaseId: candidate.databaseId,
            tableId: candidate.tableId
          }));
          continue;
        }
        throw candidateError;
      }
    }
    const profileMatches = validTables.filter(candidate => candidate.profile);
    const populatedTables = validTables.filter(candidate => candidate.hasExistingRows);
    let selectedTable = profileMatches[0] || null;
    if (!selectedTable && populatedTables.length === 1) selectedTable = populatedTables[0];
    if (!selectedTable && populatedTables.length > 1) {
      throw new Error('Multiple candidate FundB tables contain rows, but none matched this user. Refusing to create or modify a profile until the correct Profile table is confirmed.');
    }
    if (!selectedTable && validTables.length === 1) selectedTable = validTables[0];
    if (!selectedTable && validTables.length > 1) {
      throw new Error('Multiple candidate FundB tables are empty. Refusing to create a profile in an unverified table.');
    }
    if (!selectedTable) {
      const summary = candidateDiagnostics.map(item =>
        item.databaseId + '/' + item.tableId + '=' + (item.status || item.status === 0 ? item.status : item.status || 'OK') +
        (item.type ? ':' + item.type : '')
      ).join('; ');
      const discoveryError = new Error('No supplied FundB table mapping was reachable. Checked database/table candidates: ' + summary);
      discoveryError.statusCode = lastTableError && lastTableError.statusCode ? lastTableError.statusCode : null;
      discoveryError.type = 'FUNDB_TABLE_MAPPING_NOT_RESOLVED';
      throw discoveryError;
    }
    const tablePath = selectedTable.tablePath;
    let profile = selectedTable.profile;
    log('Resolved FundB profile table: ' + JSON.stringify({
      databaseId: selectedTable.databaseId,
      tableId: selectedTable.tableId,
      existingProfileFound: Boolean(profile)
    }));
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
            // Recompute from saved relationships instead of incrementing. This
            // makes concurrent profile refreshes idempotent and prevents a
            // duplicate count if two requests attach the same existing profile.
            const referredQuery = [
              { method: 'equal', attribute: 'referred_by', values: [eligibleReferrer.userId] },
              { method: 'limit', values: [1] }
            ];
            const referredQueryString = referredQuery.map(q => 'queries[]=' + encodeURIComponent(JSON.stringify(q))).join('&');
            const referredRows = await appwriteRequest(tablePath + '?' + referredQueryString, 'GET', adminHeaders);
            const exactReferralCount = Number(referredRows.total);
            if (!Number.isInteger(exactReferralCount) || exactReferralCount < 0) {
              throw new Error('Appwrite returned an invalid referral relationship count.');
            }
            await appwriteRequest(
              tablePath + '/' + encodeURIComponent(eligibleReferrer.$id),
              'PATCH', adminHeaders, { data: { total_referrals: exactReferralCount } }
            );
            log('Reconciled inviter referral counter after saving existing-profile attribution: ' + JSON.stringify({ relationshipCount: exactReferralCount }));
          } catch (reconcileError) {
            log('Referral attribution saved, but inviter counter reconciliation failed: ' + JSON.stringify({
              statusCode: reconcileError && reconcileError.statusCode,
              type: reconcileError && reconcileError.type,
              message: reconcileError && reconcileError.message
            }));
          }
        }
      } else if (existingReferrer) {
        log('Existing profile already has a referrer; attribution was not changed.');
        // Reconcile the inviter's counter from the saved relationship on every
        // profile sync. This is idempotent and does not depend on the invite URL
        // still being present after the first registration.
        try {
          const inviterQuery = [
            { method: 'equal', attribute: 'userId', values: [existingReferrer] },
            { method: 'limit', values: [1] }
          ];
          const inviterQueryString = inviterQuery.map(q => 'queries[]=' + encodeURIComponent(JSON.stringify(q))).join('&');
          const inviterMatches = await appwriteRequest(tablePath + '?' + inviterQueryString, 'GET', adminHeaders);
          const inviter = (inviterMatches.rows || [])[0];
          if (inviter && inviter.userId !== user.$id) {
            const referredQuery = [
              { method: 'equal', attribute: 'referred_by', values: [existingReferrer] },
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
              log('Referral counter reconciliation skipped: Appwrite returned an invalid relationship count.');
            }
          } else {
            log('Referral counter reconciliation skipped: saved inviter profile was not found.');
          }
        } catch (reconcileError) {
          log('Referral counter reconciliation failed without blocking profile load: ' + JSON.stringify({
            statusCode: reconcileError && reconcileError.statusCode,
            type: reconcileError && reconcileError.type,
            message: reconcileError && reconcileError.message
          }));
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
          referralCode: await createUniqueReferralCode(tablePath, adminHeaders),
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
        totalReferrals: Number(profile.total_referrals ?? profile.totalReferrals ?? 0),
        referralLinked: Boolean(profile.referred_by)
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
    // Return only non-secret diagnostic fields so the signed-in user can report
    // the exact failure without opening logs or exposing JWTs/API keys.
    const safeDiagnostic = {
      upstreamStatus: err && err.statusCode ? Number(err.statusCode) : null,
      upstreamType: err && err.type ? String(err.type).slice(0, 100) : null,
      upstreamMessage: err && err.message ? String(err.message).replace(/[\\r\\n]+/g, ' ').slice(0, 240) : 'No upstream message was returned.',
      causeCode: err && err.cause && err.cause.code ? String(err.cause.code).slice(0, 100) : null
    };
    // Older website builds display only the main message, so include the safe diagnostic there too.
    const visibleDiagnostic = [
      safeDiagnostic.upstreamStatus ? 'HTTP ' + safeDiagnostic.upstreamStatus : null,
      safeDiagnostic.upstreamType,
      safeDiagnostic.upstreamMessage,
      safeDiagnostic.causeCode
    ].filter(Boolean).join(' | ');
    return json(res, 500, {
      ok: false,
      code: err && err.statusCode ? 'APPWRITE_UPSTREAM_ERROR' : 'PROFILE_SERVICE_ERROR',
      message: 'The FundB profile request failed.' + (visibleDiagnostic ? ' Diagnostic: ' + visibleDiagnostic : ''),
      diagnostic: safeDiagnostic
    }, req.headers.origin || '');
  }
};
