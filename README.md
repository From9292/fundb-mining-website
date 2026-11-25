# FundB Mining & Media — Testnet Prototype

FundB Mining is a mobile-friendly web app prototype. This repository contains the front-end site and the existing Appwrite profile API.

## Component versions

- **Web interface:** Version 2.2 (shown in the page title).
- **Service-worker cache:** `fundb-mining-v2-6-5` (cache invalidation identifier, not the app version).
- **Appwrite profile API:** package version 1.1.0.

These version labels describe separate components and are not interchangeable.

## Repository layout

- `index.html` — app interface and Appwrite email/password authentication.
- `manifest.webmanifest` — installable web-app metadata.
- `sw.js` — service worker and static asset cache.
- `assets/` — FundB branding.
- `appwrite-function/` — Node.js source for the existing FundB Rewards API function.

## Current project status

FundB is currently a **testnet prototype**, not a live earning or payment platform. Browser-only mining credits and daily local claims are disabled. The app does not issue FUNDB rewards.

The Appwrite profile function verifies a signed-in account and loads or initializes a zero-point profile. It does not issue rewards. The following capabilities are not production-enabled:

- Rewarded advertisements and server-verified ad callbacks
- Mining sessions and server-authoritative reward calculations
- Daily rewards and task-completion credits
- Referral attribution, fraud checks and referral bonuses
- Wallet transfers, withdrawals, token issuance or exchange conversion
- Customer-support ticketing, notifications and global moderation

The BNB Smart Chain deployment is on testnet. Testnet tokens have no cash value. Any displayed dollar conversion is illustrative only and is not a market price, redemption promise or guaranteed value.

Do not promise users earnings, guaranteed token value or withdrawals until those services have been implemented, tested and approved for launch.

## Deployment notes

The `main` branch contains the current app source. Cloudflare Pages production-branch and domain settings are managed in the Cloudflare dashboard. A successful GitHub merge or preview deployment alone does not prove that the public production domain has updated.

The Appwrite function source is separate from the static Pages deployment. Use the existing Appwrite function **FundB Rewards API**; configure its root directory as `appwrite-function`, entrypoint as `index.js`, build command as `npm install`, and grant only the required dynamic API key scopes (`rows.read`, `rows.write`). The function's `userId` profile attribute must be indexed. Do not create a duplicate project, database or profile table.

Never store Appwrite API keys, user passwords, session tokens or JWTs in this repository. Configure secrets and the allowed website origin in the Appwrite Console.

## Advertising compliance

Do not incentivize users to view or click ordinary AdSense ads. If rewards are later offered for ads, use only a provider and rewarded-ad format that explicitly permit incentivized placements and verify rewards server-side. Keep ordinary non-incentivized ads separate.

## Public launch checklist

Before a public earning launch, complete server-side transaction ledgering, idempotency, rate limiting, abuse prevention, ad-provider verification, referral verification, wallet reconciliation, payout-provider integration, privacy and terms, support procedures, security review and end-to-end testing.
