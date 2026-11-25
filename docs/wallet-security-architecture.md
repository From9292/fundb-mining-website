# FundB Wallet — Security Architecture and Delivery Plan

Status: design foundation only. This document does not activate wallet creation, key generation, deposits, transfers, swaps, staking, or withdrawals.

## Product boundary

FundB Wallet is planned as a self-custody wallet with an original FundB interface. It may use familiar wallet interaction patterns, but must not copy Trust Wallet branding, assets, proprietary UI, or imply affiliation.

The existing FundB Mining dashboard, authentication, profiles, points, referrals, and reward controls are out of scope and must remain unchanged.

FUNDB must be displayed as **Coming Soon** until the canonical token contract, supported chain, token metadata, and independent verification are published. Never show a fabricated market price or cash value.

## Non-negotiable security rules

1. FundB servers, Appwrite, analytics, crash reports, support tickets, and GitHub must never receive or store a wallet recovery phrase, private key, raw seed, or decrypted keystore.
2. Never request a recovery phrase for FundB account sign-in. FundB account credentials and wallet recovery are separate systems.
3. Recovery phrases are generated only by an audited wallet cryptography implementation using a cryptographically secure random number generator and a recognized mnemonic standard (BIP-39 where supported).
4. The user must be shown the recovery phrase privately on-device, warned not to screenshot/share it, and required to verify selected words before wallet backup is marked complete.
5. A recovery phrase must never be automatically uploaded, emailed, copied to clipboard, included in logs, or included in device/cloud backups.
6. Wallet signing keys must be protected by platform secure storage. Android: Android Keystore, hardware-backed TEE/StrongBox when available; iOS: Keychain/Secure Enclave where supported. Encrypted local wallet data may be stored only with keys protected by these platform facilities.
7. Do not claim that a web page's localStorage, IndexedDB, JavaScript obfuscation, or a FundB password is equivalent to Android Keystore/iOS Keychain protection.
8. Every transaction must be previewed and explicitly approved by the user. Show chain, asset, destination, amount, network fee, and relevant contract permissions before signing.
9. Never silently switch networks, auto-sign, or ask users to enter a seed phrase to connect a dApp or contact support.
10. No real deposits, transfers, swaps, staking, or withdrawals until independent security review, test coverage, provider reliability checks, and incident-response procedures are complete.

## Architecture decision

The FundB Wallet is a first-party feature inside the FundB Mining app, not a separate wallet app or external-wallet redirect. The current FundB product is a browser-based PWA, which is not an appropriate place to implement production-grade multi-chain private-key custody merely by adding JavaScript to index.html. Secure custody therefore requires a native Android wallet module packaged inside the same FundB Android app; the PWA remains read-only until that native host exists.

Preferred production architecture:
- Android app: native Kotlin wallet module packaged inside the same FundB Mining application ID and release identity, using Android Keystore and audited cryptographic libraries.
- iOS app (when built): native Swift wallet module using Keychain/Secure Enclave protections.
- Shared chain logic: audited wallet-core implementation (evaluate Trust Wallet Core or another maintained library) behind a narrow, reviewed interface.
- Web/PWA: read-only portfolio and public-address views only, unless a separately audited browser-wallet architecture is approved. Never expose a mnemonic or signing key to the existing PWA.
- FundB backend: public metadata, token/network configuration, price-source provenance if ever enabled, transaction status/indexing, and non-secret user preferences only. Backend must not hold signing keys in a self-custody model.

## Recovery and authentication flows

### Create wallet
- Explain that the wallet is separate from the FundB Mining login.
- Generate entropy locally using the platform cryptographic random generator.
- Create the mnemonic and derive keys using audited implementations and documented derivation paths.
- Display the phrase only on a private, local screen; prevent screenshots/recording where platform support allows.
- Require offline backup and a word-order verification challenge.
- Store only an encrypted wallet container locally; protect its encryption key using platform secure storage and device authentication.
- Do not mark backup complete until verification passes.

### Restore wallet
- Restore only on-device from the phrase entered locally.
- Never transmit phrase words to FundB APIs, analytics, logs, or crash reporting.
- Validate mnemonic checksum and show the derived public addresses for user confirmation.
- Do not overwrite an existing wallet without a clear warning and explicit confirmation.

### Lock and recovery
- Support app lock with device biometrics/PIN as an additional local unlock factor, not as a replacement for the recovery phrase.
- Rate-limit unlock attempts where appropriate and clear sensitive material from memory as soon as practical.
- Explain that losing both the device and recovery phrase can mean permanent loss of access; FundB cannot recover a self-custody phrase.

## Chain rollout — staged, not "all coins at once"

Each chain is a separate reviewed integration. Initial evaluation order:
1. BNB Smart Chain (BNB native asset and verified BEP-20 tokens).
2. Ethereum (ETH and verified ERC-20 tokens).
3. Bitcoin (BTC).
4. Polygon (POL and verified tokens).
5. Solana (SOL and verified SPL tokens).
6. TRON (TRX and verified TRC-20 tokens).

This is a proposed sequence, not a statement that any chain is already supported. Add a chain only after address derivation, transaction construction/signing, fee estimation, broadcast, confirmation tracking, token metadata, and recovery compatibility tests pass.

Do not display arbitrary token logos or balances as verified assets. Token lists must be sourced from trusted registries and clearly distinguish verified from unverified assets.

## Feature gates

- Portfolio and public address display: only after reliable read-only chain data is connected.
- Receive: only after chain/network selection, address derivation, QR validation, and deposit-risk warnings are tested.
- Send: disabled until signing, fee estimation, simulation/preflight, address validation, chain-ID protection, and broadcast handling are audited.
- Swap: disabled until a vetted aggregator/provider, quote expiry, slippage, route simulation, approvals review, and provider disclosures are implemented.
- Staking: disabled until protocol risks, lockups, validator selection, reward variability, and withdrawal conditions are explained.
- NFTs and dApp connections: disabled until metadata sanitization, malicious-link defenses, WalletConnect/session permission controls, and transaction simulation are implemented.
- FUNDB: Coming Soon until official contract and token details are independently verified.

## Privacy and data minimization

Never store mnemonic, private key, raw seed, decrypted keystore, PIN, or biometric data in Appwrite. Do not collect contact lists or device fingerprints for wallet functionality. Public addresses are sensitive financial data: do not publish them in leaderboards or community feeds. Obtain explicit consent before linking a public address to a FundB profile.

## Required security test gates

- BIP-39 known test vectors and checksum validation (where BIP-39 applies).
- Derivation-path and address test vectors for every supported chain.
- Entropy-source review and duplicate-wallet probability checks.
- Recovery on a clean second device produces the same addresses.
- Wrong PIN/biometric, lockout, app backgrounding, and memory-clearing tests.
- Verify no secret appears in network traffic, logs, analytics, crash reports, source maps, local backups, or server records.
- Verify Android Keystore hardware-backed status when available and safe fallback behavior when not.
- Transaction tests on testnets, including wrong-chain, wrong-address, fee-spike, stale-quote, replay, token-approval, and RPC outage cases.
- Independent mobile application security assessment and remediation before mainnet activation.

## User-facing disclosures

- FundB account login does not back up or recover a wallet.
- FundB support will never ask for a recovery phrase or private key.
- Network fees are paid to the relevant blockchain network and may change.
- Crypto assets can lose value; no returns or token value are guaranteed.
- A transaction broadcast to a blockchain may be irreversible.
- Only use official app distribution channels and verified contract addresses.

## Current implementation status

The existing Wallet page is a disabled placeholder. No wallet keys, seed phrases, private wallet addresses, or live transaction functions have been implemented. Keep it disabled until the native secure wallet module and the relevant tests are completed.

## Official references

- BIP-39 mnemonic specification: https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki
- Trust Wallet Core source and audit reports: https://github.com/trustwallet/wallet-core
- OWASP Android cryptographic key storage: https://mas.owasp.org/MASTG/knowledge/android/MASVS-STORAGE/MASTG-KNOW-0047/
- OWASP Android Keystore guidance: https://mas.owasp.org/MASTG-KNOW-0043/
- OWASP MASVS cryptographic key management: https://mas.owasp.org/MASVS/controls/MASVS-CRYPTO-2/
