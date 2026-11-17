FUNDB REWARDS API — EXISTING APPWRITE TABLESDB PROFILE SYNC

Deploy this source to the EXISTING Appwrite Function named FundB Rewards API.
Do not create another Appwrite project, database, or Profile table.

Existing project configuration:
- Endpoint: https://nyc.cloud.appwrite.io/v1
- Project ID: 6aedc1580001af2161b0
- Database ID: fundB_database
- Profile table ID: 6aedcd650007f44a070f
- User ID column: userId
- Points column: points
- Referral code column: referralCode
- Existing website calls https://starter-function-cpbk.nyc.appwrite.run/

Function scopes:
- rows.read
- rows.write
Set execution access to Any so the endpoint can receive requests; this function validates the signed-in user's Appwrite JWT before reading or creating a row.

The code uses Appwrite's short-lived function key (x-appwrite-key) for TablesDB access. Never paste an API key into the website or this repository.

The function only reads/creates a zero-balance profile. It does NOT award points or activate mining, ads, referrals, transfers, or withdrawals.

Deployment:
1. In Appwrite Console, open Functions > FundB Rewards API.
2. Create a deployment from this folder's source, with entrypoint index.js and build command npm install.
3. Confirm rows.read and rows.write scopes are enabled under Settings > Scopes, then redeploy.
4. Keep the existing function domain.
5. Test GET on the function domain; it should return service FundB Rewards API and rewardsEnabled false.
6. Sign in on the website and refresh Saved FundB cloud profile.

If Appwrite reports a missing column, do not delete or reset existing data. Check the Profile table schema and function execution log first.
