# FundB Mining — V2.2 Community Preview

FundB Mining is a mobile-friendly web app prototype. This repository contains the front-end site and the Appwrite profile API source.

## Version labels

- **App interface:** V2.2 Community Edition (the label shown in the current page header).
- **Service-worker cache:** `fundb-mining-v2-6-1` (a cache invalidation name; it is not the app feature version).
- **Appwrite profile API:** package version 1.1.0.

These version numbers refer to different parts of the project and must not be treated as interchangeable.

## Repository layout

- `index.html` — app interface and Appwrite email/password authentication.
- `manifest.webmanifest` — installable web-app metadata.
- `sw.js` — service worker and static asset cache.
- `assets/` — FundB branding.
- `appwrite-function/` — Node.js source for the existing FundB Rewards API function.

## Current project status

The interface is a preview, not a live earning or payment platform. Browser-only mining credits and daily local claims are disabled. The app must not describe preview points as cash, cryptocurrency, or withdrawable funds.

The Appwrite profile function verifies a signed-in account and loads or initializes a zero-point profile. It does not yet issue rewards. The following are not production-enabled:

- Rewarded advertisements and server-verified ad callbacks
- Mining sessions and server-authoritative reward calculations
- Daily rewards and task completion credits
- Referral bonuses and fraud controls (the profile API supports one-time referral attribution only; no referral rewards are issued)
- Wallet transfers, withdrawals, token issuance or exchange conversion
- Customer support ticketing, notifications and global moderation

Do not promise users earnings, guaranteed token value, or withdrawals until those services have been implemented, tested, and approved for launch.

## Deployment notes

The Cloudflare Pages site is connected to this repository. Work on `fundb-production-hardening` is a development preview and should be reviewed before merging into `main`.

The Appwrite function source is separate from the static Pages deployment. Use the existing Appwrite function **FundB Rewards API**; configure its root directory as `appwrite-function`, entrypoint as `index.js`, build command as `npm install`, and grant the required dynamic API key scopes (`rows.read`, `rows.write`, and `tables.read` for read-only Profile-table discovery). The function's `userId` profile attribute must be indexed. Do not create a duplicate project, database, or profile table.

Never store Appwrite API keys, user passwords, session tokens, or JWTs in this repository. Configure secrets and allowed website origin in the Appwrite Console.

## Advertising compliance

Do not incentivize users to view or click ordinary AdSense ads. If points are later offered for ads, use only a provider and rewarded-ad format that explicitly permit incentivized rewards and verify the reward server-side. Keep ordinary non-incentivized ads separate.

## Release checklist

Before a public earning launch, complete server-side transaction ledgering, idempotency, rate limiting, abuse prevention, ad-provider verification, referral verification, wallet reconciliation, payout-provider integration, privacy/terms, support procedures, and end-to-end testing.
