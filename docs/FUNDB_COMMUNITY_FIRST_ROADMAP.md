# FundB community-first roadmap

**Release posture: remain on BNB Smart Chain testnet during the community preparation phase. No mainnet deployment is approved or scheduled by this document.**

## Phase 1 — Community preview (current)
- Keep FundB Mining visibly labelled as a preview.
- Preserve existing accounts, points, referrals, and Appwrite records.
- Keep mining rewards, ad rewards, token payouts, deposits, withdrawals, swaps, and cash-value claims disabled until their supporting systems and rules are ready.
- Explain clearly that FundB Points are not FUNDB tokens, cash, or a guaranteed airdrop.
- Allow users to explore the product and provide feedback without paying to participate or to qualify for a promised airdrop.
- Keep the deployed FUNDB contract on BNB testnet only. Never ask community members to send real assets to testnet addresses.

## Phase 2 — Rules and transparency before reward activation
Publish and version:
1. Whitepaper and project scope, including what exists now versus what is planned.
2. Points policy: earning events, caps, expiry (if any), corrections, abuse reviews, and appeal process.
3. Referral policy: qualifying referrals, anti-self-referral rules, caps, and reversal conditions.
4. Eligibility policy: supported regions, age requirements where applicable, sanctions restrictions, and exclusions.
5. Proposed token distribution: allocation categories, percentages/amounts, vesting, treasury controls, and whether participation points are considered at all.
6. Risk disclosure: no guaranteed token value, exchange listing, liquidity, conversion, or profit.
7. Privacy policy, terms, support process, and data retention policy.

Do not imply that the 10 billion testnet supply has already been allocated to users. A fixed supply does not establish user entitlements.

## Phase 3 — Safe testnet product validation
- First add read-only wallet connection and network detection, clearly labelled testnet.
- Display the testnet token balance only after validating chain ID 97 and the exact contract address.
- Never request or store wallet seed phrases or private keys.
- Test account security, referral integrity, server-authoritative points, idempotency, audit logs, rate limits, fraud controls, and support workflows.
- Do not activate real-money deposits, withdrawals, swaps, liquidity, or token claims during this phase.

## Phase 4 — Independent review and launch decision
Before considering mainnet:
- Obtain independent smart-contract security review and remediate findings.
- Complete legal, tax, privacy, advertising, consumer-protection, and jurisdiction reviews.
- Publish final tokenomics and distribution rules with clear governance and treasury controls.
- Complete operational monitoring, incident response, reconciliation, and user support plans.
- Conduct a documented go/no-go review. Mainnet requires a separate explicit owner approval; this roadmap grants none.

## Current contract reference
- Network: BNB Smart Chain Chapel testnet (chain ID 97)
- Contract: `0x6903A593920F9aA15D0673048A4D4eb40c5eE827`
- Explorer: https://testnet.bscscan.com/address/0x6903A593920F9aA15D0673048A4D4eb40c5eE827
- Testnet tokens have no established monetary value and are not mainnet assets.
