# FundB Appwrite profile API

This function verifies the signed-in Appwrite account, manages the existing FundB profile and one-time referral attribution, and serves authenticated read-only transaction history. It does not award points or create transaction records.

## Deploy this function

Use the existing Appwrite function **FundB Rewards API**. Do not create another function or another database.

- Runtime: Node.js 18 or newer (use the Node.js runtime available in your Appwrite project)
- Function root directory: `appwrite-function`
- Entrypoint: `index.js`
- Build command: `npm install`
- Function execution access: `Any` (the endpoint itself requires a valid signed-in user's JWT)
- Dynamic API key scopes: `rows.read` and `rows.write`

The source folder is in this repository at [appwrite-function](https://github.com/From9292/fundb-mining-website/tree/fundb-public-content-legal/appwrite-function).

## Existing database configuration

The code uses the existing project and table IDs already configured in FundB:

- Appwrite project: `6aedc1580001af2161b0`
- Database: `6aedcd650007f44a070f` (existing database ID; `FUNDB_DATABASE_ID` or `FUNBDATAID` may override it)
- Profile table: `profile` (or set `FUNDB_PROFILE_TABLE_ID` to the exact existing profile table ID)
- Transaction table: `fundB_transactions` (or set `FUNDB_TRANSACTIONS_TABLE_ID` to the existing table ID)

The profile table must have a `userId` string attribute and `points` numeric attribute and `referralCode` string attribute. The transaction table must contain a `userId` string attribute and the fields used by the history view (`type`, `amount`, `status`, `reference`, and `description`); index `userId` for efficient account-scoped reads. The history endpoint returns at most 50 most recent rows and filters by the verified Appwrite account ID. The profile `userId` attribute must be indexed so the function can find an existing profile. Make it unique if the current data permits. Do not delete or recreate existing rows. The code returns `totalReferrals` as zero if that optional field is not present.

Optional environment variables:
- `FUNDB_DATABASE_ID` (defaults to the existing database ID above)
- `FUNDB_PROFILE_TABLE_ID` (defaults to the existing profile table ID above)
- `FUNDB_ALLOWED_ORIGIN` (optional comma-separated list of additional exact website origins; the production and approved preview origins are built into the current code)
- `FUNDB_TRANSACTIONS_TABLE_ID` (defaults to `fundB_transactions`)

Appwrite automatically provides `APPWRITE_FUNCTION_PROJECT_ID`, the ephemeral key in `x-appwrite-key`, and the authenticated user's JWT in `x-appwrite-user-jwt`. Do not put API keys, passwords, or JWTs in GitHub.

## Security behavior

- The function rejects requests without a signed-in user's JWT.
- It obtains the user ID from Appwrite's verified account, never from browser input.
- It reads the existing profile before creating one.
- New profile rows use the authenticated user's ID as a stable row ID to reduce duplicate creation during simultaneous requests.
- New referral codes are generated with Node's cryptographic random source and checked against existing codes before assignment; existing users' codes are never changed.
- CORS is fail-closed: only the two built-in exact website origins and any additional exact origins listed in `FUNDB_ALLOWED_ORIGIN` are echoed; no wildcard origin is emitted.
- It never accepts a balance or reward amount from the browser.
- Transaction history is read-only; users cannot create, edit or delete ledger rows through this endpoint.
- It does not issue mining, daily, ad, referral, transfer, withdrawal, or token rewards.

## Still not production-enabled

Real rewards require separate server-side transaction records, idempotency keys, provider-signed rewarded-ad callbacks, referral fraud checks, rate limits, audited wallet ledger entries, and verified payout integrations. If the transaction table is not present or its schema differs, the history endpoint returns an explicit service error; it does not fabricate an empty history. Do not advertise balances as cash or enable withdrawals until those systems are built and tested.

## Referral profile behavior

The profile API stores a one-time `referred_by` relationship for an eligible invite code. On subsequent profile syncs, it recalculates the inviter's `total_referrals` from saved relationships, so a missed counter update can be repaired without counting the same referred account twice. Referral codes are submitted only during the registration flow; a later sign-in or manual profile refresh does not silently attach a stale URL code. The referred account receives a boolean `referralLinked` status; its own `totalReferrals` remains the number of people it has invited.

After changing `appwrite-function/index.js`, redeploy the existing **FundB Rewards API** function from this folder in Appwrite. A Cloudflare Pages deployment does not deploy this function automatically. Keep rewards disabled until a live Appwrite execution confirms the relationship, history schema and counter behavior.
