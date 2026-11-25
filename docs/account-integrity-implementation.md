# FundB account-integrity implementation plan

Status: design and schema specification only. The live duplicate-account detector is not enabled by this document.

## Safety goals

- Apply the published one-person, one-account participation rule consistently.
- Protect existing accounts, points, referral links, and referral counters. Never recreate or reset profiles as part of this feature.
- Use server-side evidence. Never trust a device identifier, risk score, account status, or owner flag supplied by the browser.
- A device match is a review signal, not proof that two accounts belong to one person. Shared household phones, public devices, and changing devices must be handled fairly.
- Do not permanently lock an account automatically from a device match alone.
- Restrict confirmed duplicate reward attempts proportionately; preserve sign-in and a support/review path unless an authorized reviewer makes a documented decision.
- Keep owner review controls server-authorized using verified Appwrite user IDs in a server-side allowlist. No hidden client-side owner bypass.

## Current state

The existing Appwrite function authenticates users with their Appwrite JWT and uses the server-provided function key for database operations. It currently has no device registry, no account-integrity scoring, and no duplicate-device enforcement. This is intentional: the existing Profile table schema and permissions have not yet been verified for a new registry. The public policy text does not mean the detector is operational.

Mining and reward issuance remain disabled. This feature must not enable either.

## Dedicated Appwrite table

Create a separate TablesDB table named **FundB Device Registry** with internal ID **fundb_device_registry** in the already verified FundB database. Do not add experimental fields to the existing Profile table and do not modify existing rows.

Recommended columns:

| Column | Type | Required | Purpose |
|---|---|---:|---|
| accountId | string | yes | Verified Appwrite account ID |
| installationHash | string | yes | HMAC-SHA-256 of a client-generated installation token; never store the raw token |
| keyVersion | string | yes | HMAC secret version for controlled rotation |
| firstSeenAt | datetime/string | yes | First server-observed pairing |
| lastSeenAt | datetime/string | yes | Most recent server-observed pairing |
| status | enum/string | yes | active, review, restricted, or cleared |
| riskScore | integer | yes | Server-computed score, bounded 0–100 |
| signalSummary | string | yes | Short allowlisted reason codes only; no raw IP or fingerprint |

Recommended indexes:

- Unique composite index on accountId + installationHash (idempotent account/device pairing).
- Query index on installationHash.
- Query index on accountId.
- Query index on status + lastSeenAt.

The registry must be private to the backend. Do not grant public read or write access. Only the Appwrite function's server-side key may access it. The function key needs the minimum table/row permissions required for this dedicated table.

## Required server configuration

- FUNDB_DEVICE_REGISTRY_TABLE_ID=fundb_device_registry
- FUNDB_DEVICE_HMAC_SECRET=<random high-entropy secret stored only in Appwrite function variables>
- FUNDB_ADMIN_USER_IDS=<comma-separated verified Appwrite user IDs for authorized reviewers>

Do not put these values in website JavaScript, GitHub source, screenshots, or chat. The HMAC secret must be generated and stored in Appwrite's protected function variables. Rotate it by changing keyVersion and supporting a controlled transition; do not silently invalidate every existing installation.

## Detection and response policy

1. Verify the Appwrite user JWT first. Derive accountId only from the verified Appwrite account.
2. Accept only a bounded, randomly generated installation token from the client. Never accept accountId, riskScore, status, or reviewer identity from the client.
3. HMAC the token on the server. Do not store the raw token, raw IP address, or invasive browser fingerprint.
4. Record account/installation pairings in the dedicated private table. Enforce request size limits and rate limits.
5. Treat repeated pairings, unusual sign-up bursts, duplicate mission/reward attempts, and referral abuse as separate signals. A shared installation alone must not trigger a permanent lock.
6. Low-confidence matches: allow normal access and monitor.
7. Medium-confidence matches: flag for review and protect reward claims while review is pending, without deleting the account or referral history.
8. High-confidence, corroborated abuse: apply a documented, reversible restriction to the affected reward actions. Keep a support/review route.
9. Only an authorized owner/reviewer may clear a flag or apply a stronger account restriction. Record reviewer, reason code, and timestamp in an audit record.
10. Never automatically delete accounts, profile rows, referral relationships, or historical records.

## Release gates

Do not enable collection or enforcement until all of the following are true:

- The privacy notice explains the installation token, HMAC-derived identifier, purposes, retention, and review process.
- The dedicated table, columns, indexes, and private permissions have been verified in Appwrite.
- The HMAC secret is present as a protected function variable.
- Server-side tests cover new accounts, existing accounts, shared devices, token rotation, spoofed client fields, replayed requests, rate limits, and owner authorization.
- Tests prove that existing Profile rows, points, referral codes, and referral counters are unchanged.
- The feature is first deployed in monitor-only mode and reviewed for false positives before any reward restriction is enabled.

## Explicitly out of scope

This system cannot prove a person's legal identity from a browser or phone. It must not use covert biometric collection, invasive fingerprinting, raw IP storage as identity proof, or automatic permanent lockout based solely on one device. A future identity-verification step, if ever needed, requires a separate privacy and product decision.
