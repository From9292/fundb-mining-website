# FundB BEP-20 token deployment specification

Status: **specification only — not deployed, audited, or live**.

## Approved design inputs

- Token name: FundB
- Symbol: FUNDB
- Network target: BNB Smart Chain (BSC) mainnet
- Token standard: BEP-20 (BSC-compatible ERC-20)
- Chain ID: 56
- Fixed maximum supply: 10,000,000,000 FUNDB
- Decimals: 18
- Initial supply: 10,000,000,000 FUNDB, minted once to the deployment recipient in the constructor
- Minting after deployment: prohibited; no owner, minter, proxy upgrade, or hidden mint role
- Transfer tax / reflection: none
- Automatic liquidity / swap code: none
- Admin blacklist / confiscation: none
- Token contract must be verified on BscScan after deployment.

## Exact supply

With 18 decimals, the constructor supply is:

`10,000,000,000 × 10^18 = 10,000,000,000,000,000,000,000,000,000` base units.

The supply is a fixed design parameter. It is not a promise of market value, liquidity, listing, redemption, or user allocation.

## Required implementation and independent review

Before deployment, implement the token using a pinned, audited OpenZeppelin ERC-20 dependency. Do not write a custom ERC-20 implementation. Compile with pinned Solidity compiler 0.8.39, target the BNB-supported Osaka EVM, and keep the optimizer configuration fixed and reproducible. Commit the lockfile and reproducible build settings. Add automated tests for metadata, exact initial supply, transfers, allowance behavior, zero-address handling, and the absence of privileged mint/upgrade functions. Run static analysis and an independent smart-contract security review.

The deployment recipient must be a wallet controlled by the project owner. Deploy only from that wallet after the owner verifies the exact source, compiler settings, constructor recipient, and deployment transaction. Never ask for or place a seed phrase or private key in this repository, chat, website, or Appwrite.

## Wallet activation gates

The following features must stay disabled until their separate systems are implemented and end-to-end tested:

- FUNDB contract address and token balance display
- BNB and BEP-20 USDT deposit monitoring and confirmations
- User receive/deposit addresses
- Withdrawals and payout signing
- Internal transfers and the server-authoritative double-entry ledger
- FUNDB-to-USDT / FUNDB-to-BNB swaps and liquidity

A token contract alone does not create user deposit addresses, fund a wallet, provide gas, establish liquidity, or enable withdrawals. BNB is the native gas asset; USDT must be explicitly identified as the BEP-20 contract on BSC, not another network's USDT.

## Ledger and custody requirements

Use a non-custodial wallet connection where feasible. If the service ever holds user assets, first obtain specialist legal/compliance advice and use a professionally reviewed custody/signing architecture. Never store user private keys or seed phrases.

For internal balances, use a server-authoritative, append-only double-entry ledger with atomic transactions, unique idempotency keys, per-user authorization, replay protection, rate limits, withdrawal risk checks, reconciliation, immutable audit events, and operational pause procedures. The browser must never be authoritative for balances or transaction status.

FundB Points remain promotional in-app points and must not be represented as FUNDB tokens or redeemable cash until a separately approved conversion policy, backing/liquidity, legal review, and verified on-chain implementation exist.

## Release rule

No production wallet control may be enabled merely because this specification exists or a preview deployment succeeds. Do not publish or invent a contract address. Production activation requires a verified contract, completed backend and chain integration, end-to-end tests, security review, and a controlled release with monitoring and rollback procedures.
