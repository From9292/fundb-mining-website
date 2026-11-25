# FundB owner revenue model

Status: product and security decision for planning; no revenue collection or wallet payout is implemented by this document.

## Decision

FundB must earn business revenue from clearly disclosed platform services, not by taking, borrowing, silently deducting, or controlling users' wallet assets or FundB Points. User balances and the owner's business revenue are separate accounting domains.

The owner is paid by the relevant advertising, sponsorship, affiliate, subscription, or (only after legal and security review) disclosed platform-fee provider under that provider's payout process. A displayed number in an admin dashboard is not proof of cash received; reconcile it to provider statements and bank/payment records.

## Revenue channels in recommended order

1. **Website advertising:** continue evaluating the existing AdSense publisher setup for eligible website pages. Keep ads clearly separated from wallet controls and financial confirmations. AdSense/ordinary display ads must never be presented as tasks that users must click or view to earn points.
2. **Android advertising:** if the Android app is approved for monetization, integrate Google AdMob (or another approved mobile ad network) using its current SDK, consent, app-approval and ad-placement requirements. AdSense website tags are not a substitute for the AdMob mobile-app integration.
3. **Permitted rewarded ads:** only use a rewarded-ad product whose written policy explicitly permits the proposed user reward. Validate each reward server-side from the provider's signed callback/verification mechanism; never trust a client-side "ad watched" message. Keep ad rewards as clearly labelled non-cash points unless and until a lawful, funded redemption process exists.
4. **Sponsorships and affiliate placements:** disclose commercial relationships, verify partners, and do not imply guaranteed earnings or investment returns.
5. **Optional premium features:** consider a clearly priced subscription only after there is a real, useful feature set and transparent cancellation/refund handling.
6. **Platform transaction fees:** defer. Do not charge wallet send/receive/withdrawal fees until custody model, provider contracts, exact fee calculation, user preview/consent, tax treatment, licensing and independent security review are complete. Never hide a spread or fee.

## Accounting separation

Maintain distinct records for:
- user-owned on-chain assets (public chain data; never counted as FundB revenue);
- user FundB Points/reward liabilities (not cash and not a token unless separately issued);
- gross advertising/affiliate/subscription income earned by FundB;
- provider deductions, refunds, chargebacks, taxes and operating costs;
- net business revenue actually payable to the owner.

Do not create an owner "wallet balance" by adding user balances or points. Owner revenue is payable only after provider settlement and reconciliation. If an owner dashboard is added, make it admin-only, read-only initially, and show provider, period, gross, deductions, net, settlement status, currency and evidence/reference. Never expose it to ordinary users.

## Payout and access controls

- Pay the owner through the advertising/commerce provider's verified publisher or merchant payout account to a bank/payment account owned by the business/owner, subject to provider eligibility and local law.
- Do not put payout credentials, provider secrets, Appwrite API keys, private keys or seed phrases in the Android app, PWA, Git repository, analytics or logs.
- Use server-side secrets and least-privilege access for provider callbacks; verify signatures, timestamps, replay protection and idempotency.
- Require an auditable approval and reconciliation process for refunds, adjustments and any future platform fees.
- Never use a user's recovery phrase, private key, wallet address or deposited asset to fund business expenses.

## Launch gates

Before collecting money: confirm the provider permits the app's content and reward model; complete account/app approval, consent and privacy disclosures; test ad callbacks and duplicate/replay rejection; publish clear terms; configure owner payout details directly in the provider console; and reconcile a real test settlement.

Before any wallet fee or asset payout: obtain jurisdiction-specific legal/compliance review, complete an independent wallet/security review, implement a server-authoritative double-entry ledger and transaction monitoring, disclose all fees before signing, and pass end-to-end mainnet/testnet reconciliation tests.

## Current implementation status

- Existing repository documentation identifies an AdSense publisher record, but this does not prove ads are currently serving or that revenue has accrued.
- The Android app is currently a WebView preview shell; it has no AdMob SDK or verified ad-reward callback.
- No owner revenue dashboard, payout integration, cash redemption, wallet custody or transaction-fee system is implemented by this plan.
- Do not announce earnings, revenue amounts, cashable points, or owner payouts until provider approval and settlement evidence exist.
