# FundB Appwrite profile API

This function is a **profile synchronization starter**, not a live rewards or payout engine.

## Runtime configuration

- Runtime: Node.js compatible with `node-appwrite@21.1.0`
- Entrypoint: `index.js`
- Install command: `npm install`
- Execute permission: signed-in users only (or the function's authenticated execution mode)
- Function scopes: `rows.read`, `rows.write`
- Environment variable: `FUNDB_DATABASE_ID=fundB_database`
- Environment variable: `FUNDB_PROFILE_TABLE_ID=6aedcd650007f44a070f`

Appwrite automatically supplies `APPWRITE_FUNCTION_PROJECT_ID`, `x-appwrite-key`, and (for authenticated invocations) `x-appwrite-user-jwt`. Do not put API keys or JWTs in this repository.

## Expected profile table columns

The existing Profile table must contain:
- `userId` (string; indexed and unique if possible)
- `points` (numeric)
- `referralCode` (string)

The function creates a zero-point profile only when one does not already exist. It never accepts a user ID from the browser, never trusts a browser-supplied balance, and never issues rewards.

If your actual column names or table ID differ, do not deploy until they are checked in Appwrite.

## Important safety boundary

This endpoint only verifies the signed-in Appwrite user and reads/initializes their profile. It does **not** implement rewarded ads, mining credits, daily claims, referral bonuses, transfers, withdrawals, or token issuance. Those require separate server-side transaction logic, idempotency controls, fraud checks, and provider verification.
