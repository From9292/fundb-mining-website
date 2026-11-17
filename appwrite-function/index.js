const sdk = require('node-appwrite');

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

    // Verify the caller's identity with their own short-lived Appwrite JWT.
    const userClient = new sdk.Client()
      .setEndpoint(API_ENDPOINT)
      .setProject(PROJECT_ID)
      .setJWT(jwt);
    const user = await new sdk.Account(userClient).get();

    // Use the function's short-lived key only after identity is verified.
    // Never accept a userId supplied by the browser.
    const adminClient = new sdk.Client()
      .setEndpoint(API_ENDPOINT)
      .setProject(PROJECT_ID)
      .setKey(functionKey);
    const tablesDB = new sdk.TablesDB(adminClient);

    const found = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: PROFILE_TABLE_ID,
      queries: [sdk.Query.equal('userId', [user.$id]), sdk.Query.limit(1)]
    });

    let profile = found.rows[0];
    if (!profile) {
      try {
        // A stable row ID prevents duplicate profile creation if two requests arrive together.
        profile = await tablesDB.createRow({
          databaseId: DATABASE_ID,
          tableId: PROFILE_TABLE_ID,
          rowId: user.$id,
          data: {
            userId: user.$id,
            points: 0,
            referralCode: makeReferralCode(user.$id)
          }
        });
        log('Created initial FundB profile for authenticated user.');
      } catch (createError) {
        // A simultaneous request may have created the same stable row first.
        profile = await tablesDB.getRow({
          databaseId: DATABASE_ID,
          tableId: PROFILE_TABLE_ID,
          rowId: user.$id
        });
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
