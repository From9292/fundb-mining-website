const https = require('https');
const crypto = require('crypto');
const { URL } = require('url');

const PROJECT_ID = process.env.APPWRITE_FUNCTION_PROJECT_ID;
// Older FundB deployments use FUNBDATAID. Support that existing setting
// before falling back to the placeholder database name, without changing data.
const DATABASE_ID = process.env.FUNDB_DATABASE_ID || process.env.FUNBDATAID || 'fundB_database';
const PROFILE_TABLE_ID = process.env.FUNDB_PROFILE_TABLE_ID || 'profile';
const MISSION_SUBMISSIONS_TABLE_ID = process.env.FUNDB_MISSION_SUBMISSIONS_TABLE_ID || 'fundb_mission_submissions';
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

function missionSubmissionsTablePath() {
  return '/tablesdb/' + encodeURIComponent(DATABASE_ID) +
    '/tables/' + encodeURIComponent(MISSION_SUBMISSIONS_TABLE_ID) + '/rows';
}
function appwriteQueryString(queries) {
  return queries.map(query => 'queries[]=' + encodeURIComponent(JSON.stringify(query))).join('&');
}
async function listMissionSubmissions(queries, adminHeaders) {
  const suffix = appwriteQueryString(queries);
  const result = await appwriteRequest(
    missionSubmissionsTablePath() + (suffix ? '?' + suffix : ''),
    'GET',
    adminHeaders
  );
  return result.rows || [];
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
    // Reject browser-originated requests from sites outside the exact allowlist.
    // Requests without an Origin header (server-to-server/Appwrite execution) remain supported.
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return json(res, 403, { ok: false, message: 'This website origin is not allowed to access FundB.' }, origin);
    }
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
      if (req.bodyJson && typeof req.bodyJson === 'object' && !Array.isArray(req.bodyJson)) {
        requestBody = req.bodyJson;
      } else if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
        // Some Appwrite runtimes expose parsed JSON through req.body rather
        // than req.bodyJson. Do not silently turn an action into profile sync.
        requestBody = req.body;
      } else if (typeof req.body === 'string' && req.body.trim()) {
        requestBody = JSON.parse(req.body);
      } else if (typeof req.bodyRaw === 'string' && req.bodyRaw.trim()) {
        requestBody = JSON.parse(req.bodyRaw);
      }
      if (!requestBody || typeof requestBody !== 'object' || Array.isArray(requestBody)) requestBody = {};
    } catch (_) {
      requestBody = {};
    }
    log('FundB request action diagnostics: ' + JSON.stringify({
      bodyJsonPresent: Boolean(req.bodyJson),
      bodyObjectPresent: Boolean(req.body && typeof req.body === 'object'),
      action: typeof requestBody.action === 'string' ? requestBody.action : 'profileSync'
    }));
    if (requestBody.action === 'transactionHistory') {
      // Resolve the dedicated ledger by its exact display name in the configured database.
      // The table's internal ID can differ from its display name; never guess it.
      const tableList = await appwriteRequest(
        '/tablesdb/' + encodeURIComponent(DATABASE_ID) + '/tables?search=' + encodeURIComponent('Transactions'),
        'GET',
        { 'X-Appwrite-Project': PROJECT_ID, 'X-Appwrite-Key': functionKey }
      );
      const ledgerMatches = (tableList.tables || []).filter(table =>
        String(table.name || '').trim().toLowerCase() === 'fundb transactions'
      );
      if (ledgerMatches.length !== 1) {
        const err = new Error(ledgerMatches.length
          ? 'More than one table is named FundB Transactions in the configured database. No transaction data was changed.'
          : 'The FundB Transactions table was not found in database ' + DATABASE_ID + '. Check the database and table in Appwrite; no transaction data was changed.');
        err.statusCode = ledgerMatches.length ? 409 : 404;
        err.type = ledgerMatches.length ? 'duplicate_ledger_table' : 'ledger_table_not_found';
        throw err;
      }
      const transactionsTableId = String(ledgerMatches[0].$id || ledgerMatches[0].id || '').trim();
      if (!transactionsTableId) {
        throw new Error('Appwrite returned the FundB Transactions table without an internal ID.');
      }
      const ledgerPath = '/tablesdb/' + encodeURIComponent(DATABASE_ID) +
        '/tables/' + encodeURIComponent(transactionsTableId) + '/rows';
      const ledgerQueries = [
        { method: 'equal', attribute: 'userId', values: [user.$id] },
        { method: 'orderDesc', attribute: '$createdAt' },
        { method: 'limit', values: [50] }
      ];
      const ledgerQueryString = ledgerQueries
        .map(query => 'queries[]=' + encodeURIComponent(JSON.stringify(query))).join('&');
      const ledgerResult = await appwriteRequest(ledgerPath + '?' + ledgerQueryString, 'GET', {
        'X-Appwrite-Project': PROJECT_ID,
        'X-Appwrite-Key': functionKey
      });
      const transactions = (ledgerResult.rows || []).map(row => ({
        type: String(row.type || 'Transaction').slice(0, 40),
        amount: Number(row.amount),
        status: String(row.status || 'pending').slice(0, 30),
        reference: String(row.reference || '').slice(0, 120),
        description: String(row.description || '').slice(0, 240),
        createdAt: row.createdAt || row.$createdAt || null
      })).filter(row => Number.isFinite(row.amount) && row.amount >= 0);
      return json(res, 200, { ok: true, transactions }, origin);
    }


    // Mission submissions use the authenticated Appwrite account ID. The
    // caller cannot choose a userId, status, reviewer, or reward amount.
    const missionActions = new Set([
      'submitMission',
      'myMissionSubmissions',
      'adminMissionQueue',
      'reviewMissionSubmission'
    ]);
    if (missionActions.has(requestBody.action)) {
      const missionHeaders = {
        'X-Appwrite-Project': PROJECT_ID,
        'X-Appwrite-Key': functionKey
      };
      const submissionsPath = missionSubmissionsTablePath();

      if (requestBody.action === 'submitMission') {
        const missionId = String(requestBody.missionId || '').trim();
        const evidence = String(requestBody.evidence || '').trim();
        if (!/^[A-Za-z0-9_-]{1,64}$/.test(missionId)) {
          return json(res, 400, {
            ok: false, code: 'INVALID_MISSION_ID',
            message: 'A valid mission ID is required.'
          }, origin);
        }
        if (!evidence || evidence.length > 2000) {
          return json(res, 400, {
            ok: false, code: 'INVALID_EVIDENCE',
            message: 'Evidence is required and must be 2,000 characters or fewer.'
          }, origin);
        }
        // Stable row ID makes retries idempotent for this user + mission pair.
        const rowId = crypto.createHash('sha256')
          .update(user.$id + ':' + missionId)
          .digest('hex')
          .slice(0, 32);
        try {
          const created = await appwriteRequest(submissionsPath, 'POST', missionHeaders, {
            rowId,
            data: {
              userId: user.$id,
              missionId,
              evidence,
              status: 'pending',
              reviewer: '',
              approvedPoints: 0,
              submittedAt: new Date().toISOString(),
              rejectionReason: ''
              // reviewedAt is intentionally omitted until a reviewer acts.
            }
          });
          return json(res, 201, {
            ok: true,
            submission: {
              id: created.$id,
              missionId: created.missionId,
              status: created.status,
              submittedAt: created.submittedAt
            },
            rewardsEnabled: false
          }, origin);
        } catch (createError) {
          if (createError && (createError.statusCode === 409 || createError.type === 'row_already_exists')) {
            try {
              const existing = await appwriteRequest(
                submissionsPath + '/' + encodeURIComponent(rowId),
                'GET',
                missionHeaders
              );
              return json(res, 200, {
                ok: true,
                duplicate: true,
                submission: {
                  id: existing.$id,
                  missionId: existing.missionId,
                  status: existing.status,
                  submittedAt: existing.submittedAt
                },
                rewardsEnabled: false
              }, origin);
            } catch (_) {
              // A conflict without this user's deterministic row usually means
              // the unique index is too broad (e.g. missionId alone).
              return json(res, 409, {
                ok: false,
                code: 'MISSION_UNIQUE_INDEX_MISCONFIGURED',
                message: 'The mission uniqueness index must contain both userId and missionId. No submission was created.'
              }, origin);
            }
          }
          throw createError;
        }
      }

      if (requestBody.action === 'myMissionSubmissions') {
        const rows = await listMissionSubmissions([
          { method: 'equal', attribute: 'userId', values: [user.$id] },
          { method: 'orderDesc', attribute: 'submittedAt' },
          { method: 'limit', values: [100] }
        ], missionHeaders);
        return json(res, 200, {
          ok: true,
          submissions: rows.map(row => ({
            id: row.$id,
            missionId: row.missionId,
            evidence: row.evidence,
            status: row.status,
            submittedAt: row.submittedAt,
            reviewedAt: row.reviewedAt || null,
            approvedPoints: Number(row.approvedPoints || 0),
            rejectionReason: row.rejectionReason || ''
          })),
          rewardsEnabled: false
        }, origin);
      }

      const adminIds = (process.env.FUNDB_ADMIN_USER_IDS || '')
        .split(',')
        .map(value => value.trim())
        .filter(Boolean);
      if (!adminIds.includes(user.$id)) {
        return json(res, 403, {
          ok: false,
          code: 'ADMIN_ONLY',
          message: 'This action is restricted to authorized FundB reviewers.'
        }, origin);
      }

      if (requestBody.action === 'adminMissionQueue') {
        const rows = await listMissionSubmissions([
          { method: 'equal', attribute: 'status', values: ['pending'] },
          { method: 'orderAsc', attribute: 'submittedAt' },
          { method: 'limit', values: [100] }
        ], missionHeaders);
        return json(res, 200, {
          ok: true,
          submissions: rows.map(row => ({
            id: row.$id,
            userId: row.userId,
            missionId: row.missionId,
            evidence: row.evidence,
            status: row.status,
            submittedAt: row.submittedAt
          })),
          rewardsEnabled: false
        }, origin);
      }

      const submissionId = String(requestBody.submissionId || '').trim();
      const decision = String(requestBody.decision || '').trim().toLowerCase();
      const reason = String(requestBody.rejectionReason || '').trim();
      if (!/^[A-Za-z0-9_-]{1,36}$/.test(submissionId) ||
          decision !== 'reject' || !reason || reason.length > 500) {
        return json(res, 400, {
          ok: false,
          code: 'INVALID_REVIEW',
          message: 'Only rejection with a reason (up to 500 characters) is enabled. Point approval remains disabled until the rewards ledger is verified.'
        }, origin);
      }
      const target = await appwriteRequest(
        submissionsPath + '/' + encodeURIComponent(submissionId),
        'GET',
        missionHeaders
      );
      if (target.status !== 'pending') {
        return json(res, 409, {
          ok: false,
          code: 'ALREADY_REVIEWED',
          message: 'This submission is no longer pending.'
        }, origin);
      }
      const updated = await appwriteRequest(
        submissionsPath + '/' + encodeURIComponent(submissionId),
        'PATCH',
        missionHeaders,
        {
          data: {
            status: 'rejected',
            reviewer: user.$id,
            reviewedAt: new Date().toISOString(),
            rejectionReason: reason
          }
        }
      );
      return json(res, 200, {
        ok: true,
        submission: {
          id: updated.$id,
          status: updated.status,
          reviewedAt: updated.reviewedAt
        },
        rewardsEnabled: false
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
    // Live Appwrite diagnostics confirmed fundB_database exists. The other
    // historical database identifiers returned database_not_found, so skip them.
    const knownProfileTableIds = [
      '6afea0720025daaed040',
      '6afbee8500163626863a',
      '6afd028f002b30f3902b'
    ];
    // Discover the real internal table ID from Appwrite itself instead of
    // relying on IDs copied from old screenshots or earlier guesses. This is
    // read-only and selects only the exact Profile table in the verified DB.
    let discoveredProfileTableIds = [];
    try {
      const tableList = await appwriteRequest(
        '/tablesdb/' + encodeURIComponent(DATABASE_ID) + '/tables?search=' + encodeURIComponent('Profile'),
        'GET',
        adminHeaders
      );
      discoveredProfileTableIds = (tableList.tables || [])
        .filter(table => String(table.name || '').trim().toLowerCase() === 'profile')
        .map(table => ({ tableId: table.$id || table.id, tableName: String(table.name || '').trim() }))
        .filter(table => typeof table.tableId === 'string' && table.tableId.length > 0);
      log('FundB Profile table discovery: ' + JSON.stringify({
        databaseId: DATABASE_ID,
        exactProfileTableMatches: discoveredProfileTableIds.length
      }));
    } catch (discoveryError) {
      // Listing tables requires the tables.read API-key scope. If it is not
      // granted, retain the safe read-only candidate checks below and report
      // the permission failure without exposing the key.
      log('FundB table listing unavailable; falling back to known read-only candidates: ' + JSON.stringify({
        statusCode: Number(discoveryError && discoveryError.statusCode) || null,
        type: discoveryError && discoveryError.type ? String(discoveryError.type).slice(0, 80) : null,
        message: discoveryError && discoveryError.message ? String(discoveryError.message).slice(0, 140) : 'Unknown listing error'
      }));
    }
    // Probe the verified database, discovered Profile ID, configured mapping,
    // and historical IDs. Duplicate pairs are removed below.
    const tableCandidates = [
      ...discoveredProfileTableIds.map(table => ({ databaseId: DATABASE_ID, tableId: table.tableId, tableName: table.tableName })),
      { databaseId: DATABASE_ID, tableId: PROFILE_TABLE_ID, tableName: PROFILE_TABLE_ID === 'Profile' ? 'Profile' : null },
      ...knownProfileTableIds.map(tableId => ({ databaseId: DATABASE_ID, tableId, tableName: null }))
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
        const candidateResult = {
          databaseId: candidate.databaseId,
          tableId: candidate.tableId,
          tableName: candidate.tableName || null,
          tablePath: candidatePath,
          profile: (candidateRows.rows || [])[0] || null
        };
        validTables.push(candidateResult);
        candidateDiagnostics.push({
          databaseId: candidate.databaseId,
          tableId: candidate.tableId,
          status: 'reachable',
          matchingProfile: Boolean(candidateResult.profile)
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
        // A bad or stale environment-variable mapping must not prevent
        // discovery of the other known tables. All candidate operations here
        // are read-only, so continue collecting diagnostics for every pair.
        log('FundB table candidate lookup failed; safely checking the next known mapping: ' + JSON.stringify({
          databaseId: candidate.databaseId,
          tableId: candidate.tableId,
          statusCode: Number(candidateError && candidateError.statusCode) || null,
          type: candidateError && candidateError.type ? String(candidateError.type).slice(0, 80) : null,
          message: candidateError && candidateError.message ? String(candidateError.message).replace(/[\r\n]+/g, ' ').slice(0, 140) : 'Unknown lookup error'
        }));
        continue;
      }
    }
    const profileMatches = validTables.filter(candidate => candidate.profile);
    const candidateSummary = candidateDiagnostics.map(item =>
      item.databaseId + '/' + item.tableId + '=' +
      (item.status === 'reachable' ? 'reachable' : (item.status === null ? 'unknown' : 'HTTP ' + item.status)) +
      (item.type ? ':' + item.type : '') +
      (item.message ? ':' + String(item.message).replace(/[;\r\n]+/g, ' ').slice(0, 100) : '') +
      (item.matchingProfile ? ':profile-match' : '') +
      (item.hasRows ? ':has-rows' : '')
    ).join('; ');
    // The dashboard's canonical FundB table is explicitly named "Profile"
    // (capital P). If both legacy case-variant tables contain this user, use
    // the unique exact-case canonical table. Do not merge, overwrite, or delete
    // either row. If exact-case discovery is unavailable or ambiguous, stop.
    const canonicalProfileMatches = profileMatches.filter(candidate => candidate.tableName === 'Profile');
    if (profileMatches.length > 1 && canonicalProfileMatches.length !== 1) {
      throw new Error('More than one candidate table contains this signed-in user profile, and the canonical Profile table could not be identified uniquely. No profile or referral data was changed. Candidates: ' + candidateSummary);
    }
    let selectedTable = profileMatches.length > 1 ? canonicalProfileMatches[0] : (profileMatches[0] || null);
    if (!selectedTable && validTables.length === 1) {
      // A single reachable table in the verified database is unambiguous.
      // If several tables are reachable, never guess based on row counts:
      // another FundB table may contain unrelated or legacy data.
      selectedTable = validTables[0];
    }
    if (!selectedTable && validTables.length > 1) {
      throw new Error('Multiple candidate FundB tables are reachable but none matched this user. No profile was created or changed. Candidates: ' + candidateSummary);
    }
    if (!selectedTable) {
      const discoveryError = new Error('No supplied FundB table mapping was reachable. Candidates: ' + candidateSummary);
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
      upstreamMessage: err && err.message ? String(err.message).replace(/[\r\n]+/g, ' ').slice(0, 1200) : 'No upstream message was returned.',
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
