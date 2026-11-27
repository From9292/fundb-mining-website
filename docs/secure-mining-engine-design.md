# FundB Mining Engine — Secure Backend Design

Status: **design and implementation gate only**. This document does not enable mining, award points, change user balances, or create database tables. The existing Appwrite account/profile/referral and mission data must remain untouched.

## 1. Repository audit findings

The current Appwrite function authenticates requests with the Appwrite user JWT and exposes an explicit action allowlist for profile sync, transaction history, mission submissions/review, and device registration. There are no mining-session, rewarded-ad verification, or mining-claim actions in that allowlist.

The current profile response exposes the existing `points` value and reports `rewardsEnabled: false`. The function README explicitly says it does not issue mining, daily, ad, referral, transfer, withdrawal, or token rewards. The mission flow is pending-review only; approval and point crediting are intentionally disabled until an audited server-side ledger and atomic credit flow exist.

The existing `FundB Transactions` table is read-only in the current API. It must not be repurposed as a mutable balance store or used to imply that a transaction has occurred.

## 2. Required product and provider decision

The 10-ad activation rule requires a genuine **rewarded-ad** product that supports server-side verification (SSV) or an equivalently signed server callback. Ordinary AdSense display impressions/page views are not proof that a user completed a rewarded ad and must never unlock mining or create points.

Before enabling the feature, select and configure the rewarded-ad provider for the actual Android delivery path. Record the provider's documented callback signature algorithm, key rotation process, event identifiers, timestamp tolerance, test mode, and app/ad-unit identifiers. Provider secrets belong only in Appwrite function environment variables, never in the website bundle or Git.

Until that provider is selected and verified, the UI may show a clearly labelled unavailable/test state; the API must reject ad-credit and mining-start attempts without writing reward rows.

## 3. Proposed server-owned lifecycle

1. The signed-in user requests an ad session. The server creates a random, single-use correlation/nonce and records its owner, creation time, expiry, and pending state.
2. The provider displays a rewarded ad. The client is not trusted to report completion.
3. The provider sends its server-to-server signed completion callback. The callback handler validates the signature against the provider's official algorithm and configured key, validates app/ad-unit identity, event timestamp and correlation data, and rejects test or malformed events in production.
4. The callback is idempotent: a provider event ID can be accepted once only. Replays, duplicate events, expired sessions, mismatched users, invalid signatures, and out-of-window callbacks do not grant credit.
5. The server increments the user's verified activation count using a concurrency-safe transaction or unique event ledger. Client-supplied counts, user IDs, points, rates, balances and timestamps are ignored.
6. Only after 10 distinct verified completions does the server permit a mining session to start.
7. The server creates at most one active session per user. The server stores its start time and policy version. Client clocks and client timers never determine earned points.
8. A claim endpoint calculates elapsed eligible time on the server, applies published rate/daily caps and policy version, writes an immutable ledger entry with an idempotency key, and updates/reconciles the displayed profile points through a transaction-safe operation.
9. Session status, activation progress, claim history and balances are read back from the server. A client retry returns the prior result rather than awarding again.

## 4. Data model proposal — do not create until schema is verified

Use dedicated tables/collections, separate from Profile and the existing FundB Transactions table:

- **Ad reward events**: deterministic row ID derived from provider + provider event ID; provider event ID (unique), user ID, ad/session correlation ID, ad-unit ID, verified timestamp, provider, verification status, and non-secret audit metadata.
- **Mining activation/session state**: one stable row per user; verified activation count, current session ID, session status, server start/end/last-claim timestamps, policy version, and daily eligible seconds.
- **Rewards ledger**: immutable row per credit; user ID, unique idempotency key, source type, source reference, integer points amount, policy version, server-calculated period, and created timestamp.
- **Optional daily limits**: user ID + UTC date unique key, eligible seconds, credited points, and policy version.

Before implementation, inspect the live Appwrite TablesDB schema and indexes using read-only access. Confirm database ID, internal table IDs, column types, required fields, unique indexes and transaction support. Never assume display names equal internal IDs. Never delete, recreate, rename, or migrate existing profile/referral rows as part of this work.

## 5. API boundary

Add only explicitly allowlisted actions after their tests and schema are ready:

- `adSessionCreate` — authenticated user creates a pending ad correlation session.
- `adRewardCallback` — provider server-to-server callback; authentication is provider signature verification, not a browser user JWT. Keep this route isolated from user actions.
- `miningStatus` — authenticated read of server-owned activation and session state.
- `miningStart` — authenticated request; server requires 10 unique verified events and no active session.
- `miningClaim` — authenticated, idempotent server-side claim calculation.
- `miningHistory` — authenticated read scoped to the verified Appwrite user.

Do not allow the client to submit `userId`, `points`, `balance`, `adCount`, `startedAt`, `elapsedSeconds`, `rate`, `dailyLimit`, `status`, or provider verification fields as authoritative values. Derive user identity from the verified session and reward values from server policy.

Provider callback endpoints must not depend on a browser Origin header or Appwrite user JWT. They must validate provider signatures and reject unsigned browser requests. Keep callback parsing bounded and logs free of tokens, signatures, and personal data.

## 6. Required tests before any reward is enabled

- Unauthenticated user actions and invalid/expired JWT.
- Provider callback with valid signature, invalid signature, wrong app/ad-unit, stale timestamp, malformed body and unknown correlation ID.
- Duplicate provider event ID and replayed callback.
- User A attempting to use User B's ad/session correlation ID.
- Fewer than 10 verified events; exactly 10; 10 duplicate events; more than 10.
- Concurrent callback delivery and concurrent mining start/claim requests.
- Client clock manipulation, negative/future elapsed time, daily cap, rate/policy change and session expiry.
- Idempotent claim retry and network timeout after database write.
- Cross-user history isolation and profile/ledger reconciliation.
- Existing profile points and referral fields remain unchanged except for a verified, server-calculated point credit after the feature is approved.
- Failure paths never create partial credits or mark an unverified ad as complete.

## 7. Rollout gates

1. Provider selected and official SSV documentation reviewed.
2. Live schema and atomicity/index capabilities confirmed read-only.
3. Data model and migration reviewed; additive-only migration prepared.
4. Server endpoints and tests implemented on a feature branch.
5. CI passes, including replay/concurrency/security tests.
6. Staging provider callbacks verified end-to-end with test events.
7. Product disclosure, earning rate, daily cap, and point meaning approved.
8. Only then consider enabling the feature for a small test cohort.

No real-money, token, cash-out, or guaranteed-income claim is implied by FundB Points. Wallet sends/withdrawals remain disabled and outside this mining milestone. Do not publish the app to Play Store until the owner approves after all pages and features have been tested.

## 8. Data-safety invariants

- Preserve existing Appwrite users, profiles, points, referral codes, referral relationships and mission submissions.
- Never accept client-calculated balances or reward amounts.
- Never credit a reward based on a client-side ad-complete callback.
- Never grant twice for the same provider event or claim idempotency key.
- Fail closed if provider verification, database atomicity, required indexes or policy configuration is unavailable.
- Keep all secrets in Appwrite server environment variables; never commit secrets.
