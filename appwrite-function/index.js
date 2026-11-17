const sdk = require('node-appwrite');
const { Client, Account, TablesDB, Query, ID } = sdk;

const ENDPOINT = process.env.APPWRITE_FUNCTION_API_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1';
const PROJECT_ID = process.env.APPWRITE_FUNCTION_PROJECT_ID || '6aedc1580001af2161b0';
const DATABASE_ID = process.env.FUNDB_DATABASE_ID || 'fundB_database';
const PROFILE_TABLE_ID = process.env.FUNDB_PROFILE_TABLE_ID || '6aedcd650007f44a070f';

module.exports = async ({ req, res, log, error }) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Access-Control-Allow-Headers': 'Content-Type, X-Appwrite-User-JWT',
    'Content-Type': 'application/json'
  };

  if (req.method === 'OPTIONS') return res.empty(204, cors);
  if (req.method === 'GET') {
    return res.json({
      ok: true,
      service: 'FundB Rewards API',
      stage: 'authenticated_profile_sync',
      rewardsEnabled: false
    }, 200, cors);
  }
  if (req.method !== 'POST') {
    return res.json({ ok: false, message: 'Use POST to load your FundB profile.' }, 405, cors);
  }

  try {
    const jwt = req.headers['x-appwrite-user-jwt'];
    if (!jwt) return res.json({ ok: false, message: 'Sign in to FundB first.' }, 401, cors);

    const userClient = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setJWT(jwt);
    const user = await new Account(userClient).get();

    const functionKey = req.headers['x-appwrite-key'];
    if (!functionKey) {
      return res.json({ ok: false, message: 'Appwrite function database access is not available. Check function scopes.' }, 503, cors);
    }

    const adminClient = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(functionKey);
    const tablesDB = new TablesDB(adminClient);
    const found = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: PROFILE_TABLE_ID,
      queries: [Query.equal('userId', user.$id), Query.limit(1)]
    });

    let row = found.rows?.[0];
    if (!row) {
      const referralCode = 'FB' + user.$id.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase();
      try {
        row = await tablesDB.createRow({
          databaseId: DATABASE_ID,
          tableId: PROFILE_TABLE_ID,
          rowId: ID.unique(),
          data: { userId: user.$id, points: 0, referralCode }
        });
        log('Created profile row for authenticated FundB user ' + user.$id);
      } catch (createError) {
        if (createError.code === 409) {
          const retry = await tablesDB.listRows({
            databaseId: DATABASE_ID,
            tableId: PROFILE_TABLE_ID,
            queries: [Query.equal('userId', user.$id), Query.limit(1)]
          });
          row = retry.rows?.[0];
        } else {
          throw createError;
        }
      }
    }

    if (!row) return res.json({ ok: false, message: 'Profile row could not be loaded. Check the existing Profile table columns.' }, 500, cors);

    return res.json({
      ok: true,
      profile: {
        userId: user.$id,
        displayName: user.name || '',
        points: Number.isFinite(Number(row.points)) ? Number(row.points) : 0,
        referralCode: row.referralCode || '',
        totalReferrals: Number(row.total_referrals || row.totalReferrals || 0)
      },
      rewardsEnabled: false,
      message: 'Cloud profile loaded. Earning features remain disabled until secure reward verification is implemented.'
    }, 200, cors);
  } catch (e) {
    error(e && e.stack ? e.stack : String(e));
    const status = Number(e && e.code) === 401 ? 401 : 500;
    return res.json({
      ok: false,
      message: status === 401
        ? 'Your Appwrite session expired. Sign in again.'
        : 'FundB could not load your profile. Check the Profile table ID, columns and function scopes.'
    }, status, cors);
  }
};
