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

The verified existing FundB database ID is `fundB_database`. The function checks this database first against the three table IDs supplied for the Profile lookup:

- `6afea0720025daaed040`
- `6afbee8500163626863a`
- `6afd028f002b30f3902b`

It probes these tables for the signed-in user's existing profile and existing rows. It will not create a profile in an arbitrary table when multiple candidates remain ambiguous. Earlier mappings are retained only as compatibility probes. Do not delete or recreate existing rows.

The selected Profile table must have these columns before profile creation and referral lookup can work:

- `userId`: string, required, indexed (unique if existing rows permit)
- `points`: numeric
- `referralCode`: string, indexed (unique if existing rows permit)
- `total_referrals`: numeric
- `referred_by`: string, optional, indexed for referral reconciliation

The previously supplied Profile-table screenshot showed `userId`, `points`, `referred_by`, and `total_referrals`, but did not visibly show `referralCode`. Confirm that `referralCode` exists as a column in the selected table before expecting referral codes to load or new profiles to be created. Do not create duplicate tables or delete existing rows.

Optional environment variables:
- `FUNDB_DATABASE_ID` (defaults to `fundB_database`)
- `FUNDB_PROFILE_TABLE_ID` (legacy fallback table ID)
- `FUNDB_ALLOWED_ORIGIN` (optional comma-separated exact-origin allowlist. Defaults to the known Netlify and Cloudflare Pages FundB origins; set it to your current exact website origin(s) if the hosting domain changes.)

Appwrite automatically provides `APPWRITE_FUNCTION_PROJECT_ID`, the ephemeral key in `x-appwrite-key`, and the authenticated user's JWT in `x-appwrite-user-jwt`. Do not put API keys, passwords, or JWTs in GitHub.

## Security behavior

- The function rejects requests without a signed-in user's JWT.
- It obtains the user ID from Appwrite's verified account, never from browser input.
- It reads the existing profile before creating one.
- New profile rows use the authenticated user's ID as a stable row ID to reduce duplicate creation during simultaneous requests.
- New referral codes are generated with Node's cryptographic random source and checked against existing codes before assignment; existing users' codes are never changed.
- CORS is fail-closed: only the exact `FUNDB_ALLOWED_ORIGIN` is allowed, and no wildcard origin is emitted.
- It never accepts a balance or reward amount from the browser.
- It does not issue mining, daily, ad, referral, transfer, withdrawal, or token rewards.

## Still not production-enabled

Real rewards require separate server-side transaction records, idempotency keys, provider-signed rewarded-ad callbacks, referral fraud checks, rate limits, audited wallet ledger entries, and verified payout integrations. Do not advertise balances as cash or enable withdrawals until those systems are built and tested.


## Referral profile behavior

The profile API stores a one-time `referred_by` relationship for an eligible invite code. On subsequent profile syncs, it recalculates the inviter's `total_referrals` from saved relationships, so a missed counter update can be repaired without counting the same referred account twice. Referral codes are submitted only during the registration flow; a later sign-in or manual profile refresh does not silently attach a stale URL code. The referred account receives a boolean `referralLinked` status; its own `totalReferrals` remains the number of people it has invited.

After changing `appwrite-function/index.js`, redeploy the existing **FundB Rewards API** function from this folder in Appwrite. A Cloudflare Pages deployment does not deploy this function automatically. Keep rewards disabled until a live Appwrite execution confirms the relationship and counter behavior.
