# FundB rewards ledger — implementation contract

## Status

This document is a design contract only. It does not activate rewards, create database rows, change balances, or enable withdrawals. The current profile API remains the only active server API and must continue returning `rewardsEnabled: false`.

## Non-negotiable rules

1. The browser never chooses a reward amount, balance, user ID, transaction status, or payout result.
2. Every credit is created by a trusted server path after verifying its source event.
3. Every event has a stable idempotency key with a unique database constraint. Replaying an event must return the original result and never create a second credit.
4. Ledger entries are append-only. Corrections use compensating entries; never edit or delete a posted entry.
5. Preview points, approved promotional points, token allocations, and cash payouts are separate asset types and must never be silently converted.
6. A balance is the sum of posted ledger entries, not a browser counter or a mutable client-submitted number.
7. No withdrawal or transfer endpoint exists until a funded payout provider, identity/compliance rules where required, reconciliation, support and dispute handling are ready.

## Required data model (Appwrite TablesDB)

Create and verify these tables in the existing Appwrite database only after reviewing the live schema. Do not create a duplicate project, database, or profile table.

### `fundb_reward_events`

- `eventKey` — string, required, unique; provider event ID or server-generated idempotency key.
- `userId` — string, required, indexed.
- `eventType` — string, required (for example `ad_completed`, `task_verified`, `referral_qualified`, `admin_adjustment`).
- `source` — string, required (provider/task/admin system identifier).
- `sourceReference` — string, optional; provider transaction or task reference.
- `status` — string, required (`received`, `verified`, `rejected`, `posted`).
- `payloadHash` — string, required; hash of the canonical verified event, not raw secrets.
- `createdAt` — datetime, required.
- `verifiedAt` — datetime, optional.
- `postedAt` — datetime, optional.

### `fundb_ledger_entries`

- `entryKey` — string, required, unique and deterministic from the verified event.
- `userId` — string, required, indexed.
- `asset` — string, required (`FUNDB_PREVIEW_POINT`, `FUNDB_PROMO_POINT`, or a separately approved future asset).
- `amount` — integer, required; store smallest units only and reject zero/negative credit requests except explicitly modelled debit/reversal entries.
- `direction` — string, required (`credit`, `debit`, `reversal`).
- `eventKey` — string, required, indexed.
- `description` — string, required and user-safe.
- `createdAt` — datetime, required.
- `reversalOf` — string, optional; original entry key.

Unique constraints are mandatory for `eventKey` and `entryKey`. Index `userId + createdAt` for history and `eventKey` for reconciliation. Confirm the actual Appwrite schema and supported index definitions in the console before deploying code.

## Processing sequence

1. Receive a provider callback or verified server-side task result. Never accept a client claim as proof.
2. Verify provider signature, timestamp, app/site identity, completion status and replay window.
3. Validate the user mapping from the provider's signed payload; do not trust a user ID supplied only by the browser.
4. Insert the event with its unique `eventKey`. If it already exists, return the prior outcome without crediting again.
5. Apply event-specific eligibility and anti-abuse rules (self-referrals, duplicate accounts, device/IP velocity, task reuse, chargebacks and provider reversals).
6. In one transaction where supported, insert the ledger entry and mark the event posted. If atomic transactions are unavailable, use a recoverable state machine and reconciliation job.
7. Derive balances from posted entries and return a server-generated history.
8. Log event IDs and outcomes only. Never log JWTs, API keys, provider secrets or raw sensitive payloads.

## Release gates

- Database schema and unique indexes verified in the existing Appwrite project.
- Provider signature verification tested with valid, invalid, expired and replayed callbacks.
- Concurrent duplicate-event test proves exactly one ledger entry.
- Negative, zero, overflow, wrong-user and unknown-event tests pass.
- Referral qualification rules and self-referral/multi-account controls documented and tested.
- Balance reconciliation detects missing/orphaned events and ledger entries.
- Admin adjustments are permission-restricted, reason-coded and auditable.
- Privacy notice, terms, support and dispute process describe the actual system.
- End-to-end staging tests pass before any production reward switch is enabled.

## Current user-facing truth

FundB remains a community preview. No mining, ad, task, referral, daily, token, transfer or withdrawal rewards are currently active. Do not change this status until every release gate above is met and a funded, approved reward source is connected.
