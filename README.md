# FundB Mining — Community Preview

FundB Mining is a mobile-friendly community app prototype. This repository contains the front-end site and the Appwrite profile and mission API source.

## Repository layout

- `index.html` — app interface and Appwrite email/password authentication.
- `manifest.webmanifest` — installable web-app metadata.
- `sw.js` — service worker and static asset cache.
- `assets/` — FundB branding.
- `appwrite-function/` — Node.js source for the FundB Rewards API function.

## Current project status

The interface is a preview, not a live earning, custody or payment platform. Browser-only mining credits and daily local claims are disabled. FundB Points shown in the preview are not cash, cryptocurrency, a guaranteed exchange rate or withdrawable funds.

The Appwrite profile function verifies a signed-in account and loads or initializes a profile. The mission API accepts authenticated submissions for review; mission approval and point crediting remain disabled. The following are not production-enabled:

- Rewarded advertisements and server-verified ad callbacks
- Mining sessions and server-authoritative reward calculations
- Daily rewards and task completion credits
- Referral bonuses (the profile API supports referral attribution only; no referral rewards are issued)
- Wallet address issuance, deposits, transfers, withdrawals, token issuance or exchange conversion
- Customer support ticketing, notifications and global moderation

Do not promise users earnings, guaranteed token value, token allocation or withdrawals until those services have been implemented, tested and approved for launch.

## Deployment and Appwrite configuration

The Cloudflare Pages site is connected to this repository. The `fundb-production-hardening` branch is the production-hardening working branch; confirm the actual Pages deployment and domain before announcing a release.

The Appwrite function source is separate from the static Pages deployment. Use the existing Appwrite function **FundB Rewards API** with `appwrite-function` as its source directory and `index.js` as its entrypoint. Configure the required API key scopes in the Appwrite Console and preserve the existing project, database, tables, environment variables and user data. Do not create a duplicate project, database or profile table.

The function reads the database identifier from `FUNDB_DATABASE_ID`, then the legacy `FUNBDATAID` setting, and finally falls back to the literal `fundB_database`. Keep the working value already configured in the existing Appwrite function; do not replace it with a guessed identifier. The profile table defaults to `profile`, and the mission-submissions table defaults to `fundb_mission_submissions`, unless their corresponding environment variables are set.

Never store Appwrite API keys, user passwords, session tokens or JWTs in this repository. Configure secrets and allowed website origins in the Appwrite Console.

## Transaction history (read-only)

The authenticated `transactionHistory` action discovers the exact `FundB Transactions` table by display name in the configured database. It uses the internal table ID returned by Appwrite; do not set a separate `FUNDB_TRANSACTIONS_TABLE_ID` variable. The function fails closed if the exact table is missing or more than one table has that name.

The read-only endpoint queries the latest 50 rows belonging to the Appwrite-authenticated user. The owner filter is derived from the verified Appwrite identity, not from a user ID supplied in the browser. It does not create transactions, award points or enable deposits, withdrawals, transfers or mining rewards. The wallet history display is read-only.

If the table is not present or its schema is not ready, transaction history will report an error; do not create a guessed schema or change existing transaction data just to clear the message. Confirm the existing Appwrite table and its attributes before making any schema change.

## Wallet activation requirements

Wallet features must remain disabled until all relevant components are selected, implemented and tested:

1. **Receive address:** choose the launch blockchain and wallet/custody model; deploy and verify the token contract; issue addresses through a trusted provider or audited wallet implementation; test address ownership and deposit confirmations.
2. **Withdrawal address:** select a supported network; validate addresses for that network; verify account ownership and user confirmation; implement risk checks, limits, fee disclosure, payout signing and reconciliation.
3. **Internal transfer:** implement a server-authoritative balance ledger with atomic debit/credit, unique idempotency keys, authorization, rate limits, fraud controls and immutable audit records.
4. **Transaction history:** write ledger entries only from trusted server processes and show each signed-in user only their own entries.

Never request or store users' seed phrases or private keys in the website or Appwrite profile. Do not enable a button until its complete server-side workflow has passed end-to-end tests. No existing balances or profile data should be migrated or reset as part of wallet development.

## Advertising compliance

Do not incentivize users to view or click ordinary AdSense ads. If points are later offered for ads, use only a provider and rewarded-ad format that explicitly permit incentivized rewards and verify rewards server-side. Keep ordinary non-incentivized ads separate.

## Release checklist

Before a public earning or wallet launch, complete server-side transaction ledgering, idempotency, rate limiting, abuse prevention, ad-provider verification, referral verification, wallet reconciliation, payout-provider integration, privacy and terms review, support procedures and end-to-end testing.
