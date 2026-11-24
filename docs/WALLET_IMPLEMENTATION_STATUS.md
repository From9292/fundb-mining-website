# FundB wallet implementation status

Status: **testnet contract deployed; app wallet integration is not activated.**

## Current testnet contract (not mainnet)
- Network: BNB Smart Chain Chapel testnet
- Chain ID: `97`
- Contract: `0x6903A593920F9aA15D0673048A4D4eb40c5eE827`
- Explorer: https://testnet.bscscan.com/address/0x6903A593920F9aA15D0673048A4D4eb40c5eE827
- Deployment transaction: https://testnet.bscscan.com/tx/0x416404b89f48ed603d683d583bc5fd441356fee90034f4dffc80cb133eae94b1
- Name / symbol: FundB / FUNDB
- Decimals: 18
- Fixed supply: 10,000,000,000 FUNDB
- Initial holder: `0xeccfc01cbf7dcbfad98f87485361f70c8080e833`
- Deployer: `0xcF8294de3Ad14344FDb608360622af579FC15eE6`

The GitHub Actions deployment run reported success, verified chain ID 97 and the deployer, and checked the configured holder and supply. This is a testnet deployment only. Test tokens have no established monetary value.

## Current product boundary
The website remains a preview. FundB Points are participation points, not FUNDB tokens, cash, shares, or a guaranteed airdrop. Mining rewards, rewarded ads, withdrawals, swaps, deposits, and token payouts are not active. Do not describe preview balances as withdrawable funds.

The deployed testnet contract does not itself create app user wallets, allocate tokens to participants, create liquidity, or enable withdrawals. Keep the contract address clearly labelled TESTNET wherever it is shown.

## Wallet integration status
Not implemented or activated:
- Non-custodial wallet connection and chain verification in the app
- Read-only testnet balance display
- Deposit address issuance or deposit monitoring
- Confirmation and chain reorganisation handling
- Withdrawal signing or payout reconciliation
- Internal double-entry ledger, swaps, or liquidity

Any future wallet work must begin with a read-only testnet integration. Never request, store, or transmit a user's seed phrase or private key. Wallet connection must use a trusted wallet provider and request only the minimum permissions required.

## Gates before any mainnet release
1. Publish a complete, versioned whitepaper and plain-language participation, points, referral, eligibility, anti-abuse, and token distribution rules.
2. Define what FundB Points mean and explicitly state whether, when, and under what conditions they may be considered for any future allocation. Do not promise conversion or guaranteed airdrops.
3. Complete jurisdiction-specific legal, tax, consumer-protection, privacy, sanctions, and advertising-policy reviews.
4. Publish token allocation, vesting/lockup, treasury, liquidity, and governance disclosures; explain the initial holder allocation and controls.
5. Obtain independent smart-contract security review and complete static analysis.
6. Build and test server-authoritative reward accounting, fraud prevention, audit trails, support and dispute handling.
7. Complete testnet end-to-end testing and an independently reviewed release checklist.
8. Obtain a separate, explicit owner approval for any mainnet deployment. Testnet approval is not mainnet approval.

Never place seed phrases or private keys in chat, source control, website code, browser storage, or Appwrite.
