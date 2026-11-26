# FundB Appwrite profile API

This function is the first server-side API for FundB. It verifies the signed-in Appwrite account, loads the existing profile, and creates a zero-point profile only when one does not exist. It does not award points.

## Deploy this function

Use the existing Appwrite function **FundB Rewards API**. Do not create another function or another database.

- Runtime: Node.js 18 or newer (use the Node.js runtime available in your Appwrite project)
- Function root directory: `appwrite-function`
- Entrypoint: `index.js`
- Build command: `npm install`
- Function execution access: `Any` (the endpoint itself requires a valid signed-in user's JWT)
- Dynamic API key scopes: `rows.read`, `rows.write`, and `tables.read`. `tables.read` is required for read-only discovery of the exact Profile and FundB Transactions tables; `rows.read` supports profile, referral, mission and transaction-history lookups; `rows.write` supports the existing profile, referral-attribution and mission-submission writes. The transaction-history action itself is read-only.

The source folder is in this repository at [appwrite-function](https://github.com/From9292/fundb-mining-website/tree/fundb-production-hardening/appwrite-function).

## Existing database configuration

The verified existing FundB database ID is `fundB_database`. The function first attempts a read-only TablesDB listing to resolve the internal ID of the exact table named **Profile**. If discovery is unavailable, known candidate IDs may be checked only to read an already-existing matching profile; a legacy fallback is never used to create a profile or change referral relationships. New profile creation and referral writes require exact Profile table discovery through `tables.read`. Do not delete or recreate existing rows or tables.

The selected Profile table must have these columns before profile creation and referral lookup can work:

- `userId`: string, required, indexed (unique if existing rows permit)
- `points`: numeric
- `referralCode`: string, indexed (unique if existing rows permit)
- `total_referrals`: numeric
- `referred_by`: string, optional, indexed for referral reconciliation

The previously supplied Profile-table screenshot showed `userId`, `points`, `referred_by`, and `total_referrals`, but did not visibly show `referralCode`. Confirm that `referralCode` exists as a column in the selected table before expecting referral codes to load or new profiles to be created. Do not create duplicate tables or delete existing rows.

Optional environment variables:
- `FUNDB_DATABASE_ID` (defaults to `fundB_database`)
- `FUNDB_PROFILE_TABLE_ID` (legacy read-only fallback candidate; it is not used for profile creation or referral writes unless exact Profile table discovery confirms the same internal ID)
- `FUNDB_ALLOWED_ORIGIN` (optional comma-separated exact-origin allowlist. Defaults to the known Netlify and Cloudflare Pages FundB origins; set it to your current exact website origin(s) if the hosting domain changes.)

Appwrite automatically provides `APPWRITE_FUNCTION_PROJECT_ID`, the ephemeral key in `x-appwrite-key`, and the authenticated user's JWT in `x-appwrite-user-jwt`. Do not put API keys, passwords, or JWTs in GitHub.

## Transaction history (read-only)

The website's transaction-history refresh calls the authenticated `transactionHistory` action. The function searches the configured `fundB_database` for exactly one table whose display name is **FundB Transactions**, then uses the internal table ID returned by Appwrite. It does not assume that the display name and internal ID are the same. The function verifies the signed-in user and returns only rows whose `userId` matches that verified account, newest first, up to 50 rows. An empty table correctly returns an empty history. If the table is missing or duplicated, the request fails closed and reads no ledger rows. This action is read-only: it does not create ledger rows or enable rewards, deposits, transfers, or withdrawals.


## Mission submissions (pending review only)

The authenticated API supports four actions:

- `submitMission`: accepts only the five published mission IDs (`digital-safety-checklist`, `community-contribution`, `scam-awareness`, `learning-reflection`, `product-feedback`) and evidence text (maximum 2,000 characters). Adding a mission requires updating the server allowlist and tests. The user ID is always taken from the verified Appwrite session. The server sets `status=pending`, `approvedPoints=0`, and the submission timestamp; it ignores caller-supplied reviewer, status, points, and user ID. Existing submissions remain readable and are not changed.
- `myMissionSubmissions`: returns only the signed-in user's submissions.
- `adminMissionQueue`: returns pending submissions only to user IDs explicitly listed in `FUNDB_ADMIN_USER_IDS`.
- `reviewMissionSubmission`: currently supports rejection with a required reason. Approval and point crediting remain disabled until a server-side rewards ledger and atomic credit flow are implemented and tested.

Configure these optional environment variables on the existing **FundB Rewards API** function:

- `FUNDB_MISSION_SUBMISSIONS_TABLE_ID` (defaults to the existing table ID `fundb_mission_submissions`)
- `FUNDB_ADMIN_USER_IDS` (comma-separated Appwrite user IDs authorized to view the review queue and reject submissions; do not use email addresses or expose this setting to the browser)

The existing `fundb_mission_submissions` table must retain the verified columns: `userId` (string, 36), `missionId` (string, 64), `evidence` (string, 2,000), `status` (string, 20), `reviewer` (string, 36), `approvedPoints` (integer, 0–70), `submittedAt` (datetime), `reviewedAt` (datetime), and `rejectionReason` (string, 500). Pending rows intentionally omit `reviewedAt`; Appwrite Datetime fields must not receive an empty string.

Required indexes:

- `user_mission_unique`: **Unique**, columns `userId` ASC + `missionId` ASC. A unique index on `missionId` alone is incorrect because it would prevent different users from submitting the same mission.
- `status_submittedAt`: **Key**, columns `status` ASC + `submittedAt` DESC, used by the pending review queue.

Keep table permissions empty and row-level security disabled; the API uses the function's server-side key after verifying the caller. Never grant public table access. The function does not award points, approve rewards, or create transaction-ledger rows.

## Security behavior

- The function rejects requests without a signed-in user's JWT.
- It obtains the user ID from Appwrite's verified account, never from browser input.
- It reads the existing profile before creating one.
- If exact Profile table discovery is unavailable, legacy candidate IDs are read-only: existing profiles may be returned, but new profile creation and referral relationship/counter writes are blocked until `tables.read` discovery succeeds.
- New profile rows use the authenticated user's ID as a stable row ID to reduce duplicate creation during simultaneous requests.
- New referral codes are generated with Node's cryptographic random source and checked against existing codes before assignment; existing users' codes are never changed.
- Browser requests with an `Origin` header outside the exact allowlist are rejected with HTTP 403 before any Appwrite API request. Approved origins receive the matching CORS header; server-to-server requests without an `Origin` header remain supported.
- It never accepts a balance or reward amount from the browser.
- It does not issue mining, daily, ad, referral, transfer, withdrawal, or token rewards.

## Still not production-enabled

Real rewards require separate server-side transaction records, idempotency keys, provider-signed rewarded-ad callbacks, referral fraud checks, rate limits, audited wallet ledger entries, and verified payout integrations. Do not advertise balances as cash or enable withdrawals until those systems are built and tested.

## Referral profile behavior

The profile API stores a one-time `referred_by` relationship for an eligible invite code. On subsequent profile syncs, it recalculates the inviter's `total_referrals` from saved relationships, so a missed counter update can be repaired without counting the same referred account twice. Referral codes may be submitted during registration or through the account's explicit one-time “Apply an invitation code” action while the profile has no inviter. A later sign-in or ordinary profile refresh does not silently attach a stale URL code. The referred account receives a boolean `referralLinked` status; its own `totalReferrals` remains the number of people it has invited.

After changing `appwrite-function/index.js`, redeploy the existing **FundB Rewards API** function from this folder in Appwrite. A Cloudflare Pages deployment does not deploy this function automatically. Keep rewards disabled until a live Appwrite execution confirms the relationship and counter behavior.
