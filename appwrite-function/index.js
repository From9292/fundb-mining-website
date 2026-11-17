const sdk = require('node-appwrite');

const PROJECT_ID = process.env.APPWRITE_FUNCTION_PROJECT_ID;
const DATABASE_ID = process.env.FUNDB_DATABASE_ID || 'fundB_database';
const PROFILE_TABLE_ID = process.env.FUNDB_PROFILE_TABLE_ID || '6aedcd650007f44a070f';

function json(res, statusCode, payload) {
  return res.json(payload, statusCode);
}

function makeReferralCode(userId) {
  return 'FB' + userId.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase();
}

module.exports = async ({ req, res, log, error }) => {
  try {
    if (req.method !== 'POST') {
      return json(res, 405, { ok: false, message: 'Method not allowed.' });
    }

    const jwt = req.headers['x-appwrite-user-jwt'];
    const functionKey = req.headers['x-appwrite-key'];
    if (!PROJECT_ID || !jwt || !functionKey) {
      return json(res, 401, { ok: false, message: 'Please sign in to your FundB account.' });
    }

    // Verify the caller's identity with their own short-lived Appwrite JWT.
    const userClient = new sdk.Client()
      .setEndpoint('https://nyc.cloud.appwrite.io/v1')
      .setProject(PROJECT_ID)
      .setJWT(jwt);
    const user = await new sdk.Account(userClient).get();

    // Use the function's short-lived key only after identity is verified.
    // Never accept a userId supplied by the browser.
    const adminClient = new sdk.Client()
      .setEndpoint('https://nyc.cloud.appwrite.io/v1')
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
      profile = await tablesDB.createRow({
        databaseId: DATABASE_ID,
        tableId: PROFILE_TABLE_ID,
        rowId: sdk.ID.unique(),
        data: {
          userId: user.$id,
          points: 0,
          referralCode: makeReferralCode(user.$id)
        }
      });
      log('Created initial FundB profile for authenticated user.');
    }

    return json(res, 200, {
      ok: true,
      profile: {
        points: Number(profile.points || 0),
        referralCode: profile.referralCode || 'Not assigned',
        totalReferrals: Number(profile.totalReferrals || 0)
      },
      rewardsEnabled: false
    });
  } catch (err) {
    error('FundB profile API error: ' + (err && err.message ? err.message : 'Unknown error'));
    return json(res, 500, { ok: false, message: 'The FundB profile could not be loaded. Please try again.' });
  }
};
