# FundB Appwrite profile API

This function is the first server-side API for FundB. It verifies the signed-in Appwrite account, loads the existing profile, and creates a zero-point profile only when one does not exist. It does not award points.

## Deploy this function

Use the existing Appwrite function **FundB Rewards API**. Do not create another function or another database.

- Runtime: Node.js 18 or newer (use the Node.js runtime available in your Appwrite project)
- Function root directory: `appwrite-function`
- Entrypoint: `index.js`
- Build command: `npm install`
- Function execution access: `Any` (the endpoint itself requires a valid signed-in user's JWT)
- Dynamic API key scopes: `rows.read` and `rows.write`

The source folder is in this repository at [appwrite-function](https://github.com/From9292/fundb-mining-website/tree/fundb-production-hardening/appwrite-function).

## Existing database configuration

The code uses the existing project and table IDs already configured in FundB:

- Appwrite project: `6aedc1580001af2161b0`
- Database: `fundB_database`
- Profile table: `6aedcd650007f44a070f`

The profile table must have a `userId` string attribute and `points` numeric attribute and `referralCode` string attribute. The `userId` attribute must be indexed so the function can find an existing profile. Make it unique if the current data permits. Do not delete or recreate existing rows. The code returns `totalReferrals` as zero if that optional field is not present.

Optional environment variables:
- `FUNDB_DATABASE_ID` (defaults to the existing database ID above)
- `FUNDB_PROFILE_TABLE_ID` (defaults to the existing profile table ID above)
- `FUNDB_ALLOWED_ORIGIN` (set this to the exact deployed FundB website origin when known; the default `*` is only a broad CORS setting, not an authentication mechanism)

Appwrite automatically provides `APPWRITE_FUNCTION_PROJECT_ID`, the ephemeral key in `x-appwrite-key`, and the authenticated user's JWT in `x-appwrite-user-jwt`. Do not put API keys, passwords, or JWTs in GitHub.

## Security behavior

- The function rejects requests without a signed-in user's JWT.
- It obtains the user ID from Appwrite's verified account, never from browser input.
- It reads the existing profile before creating one.
- New profile rows use the authenticated user's ID as a stable row ID to reduce duplicate creation during simultaneous requests.
- It never accepts a balance or reward amount from the browser.
- It does not issue mining, daily, ad, referral, transfer, withdrawal, or token rewards.

## Still not production-enabled

Real rewards require separate server-side transaction records, idempotency keys, provider-signed rewarded-ad callbacks, referral fraud checks, rate limits, audited wallet ledger entries, and verified payout integrations. Do not advertise balances as cash or enable withdrawals until those systems are built and tested.
