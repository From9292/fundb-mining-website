# FundB Wallet — In-App Custody Delivery Plan

Status: implementation plan only. This is not a live wallet and does not generate or hold keys.

## Product decision: one FundB app

FundB Wallet is a first-party feature inside the existing FundB Mining application. Users open it from the FundB Mining app navigation and remain within the FundB product and app identity. It is not a separate Trust Wallet installation, external wallet redirect, or third-party custody account.

The wallet's custody boundary is the user's device. FundB operates the application and public blockchain services; the user controls the recovery phrase and signing authority. FundB staff, Appwrite administrators, support agents, and backend functions must not be able to recover or spend user funds.

## Delivery shape

- Keep the current FundB Mining PWA and dashboard intact.
- Add the wallet as a dedicated in-app screen/feature once the native Android host is established.
- Package the secure wallet module inside the same FundB Android application (same application ID and release signing identity). Do not ship a second wallet app.
- The PWA may show a clearly labelled read-only wallet entry point, but must not create, import, store, export, or sign with private keys.
- If a user opens the PWA without the native secure-wallet capability, show a clear "Secure wallet setup is available in the FundB Android app" state rather than pretending browser storage is secure custody.

## Custody and recovery boundary

1. Generate entropy and the recovery phrase on-device with an audited cryptographic implementation.
2. Derive wallet keys locally using documented chain derivation paths.
3. Protect local wallet data with encryption keys held by Android Keystore; prefer StrongBox/TEE hardware-backed protection where available and report capability honestly.
4. Do not upload recovery phrases, raw seeds, private keys, decrypted keystores, wallet PINs, or biometric material to Appwrite or any FundB server.
5. Appwrite may store account preferences and explicitly consented public addresses, but public-address linking must be optional and clearly disclosed.
6. FundB account password reset must never reset or reveal wallet recovery material.
7. Wallet restore takes place only inside the trusted in-app native screen. Never ask users to send recovery words to support or enter them into a website form.

## Initial feature scope

The first production milestone is deliberately small:
- Create wallet locally.
- Display the recovery phrase once in a protected flow.
- Verify backup with a word-order challenge.
- Lock/unlock using device authentication and a local wallet PIN policy.
- Derive and display a BNB Smart Chain address on the correct network.
- Show public address and QR code only after address derivation tests pass.
- Read public balances through a separately selected and monitored RPC/indexing provider.

Send, receive deposits, token approvals, swaps, staking, NFTs, dApp connections, and withdrawals remain disabled until their own threat model, transaction preview, fee checks, signing tests, recovery tests, and independent security review pass. A displayed receive address is not to be enabled until address derivation and chain/network labels are verified.

## Library and integration evaluation

Evaluate maintained, audited wallet cryptography libraries such as Trust Wallet Core rather than writing mnemonic, elliptic-curve, derivation, or transaction-signing code from scratch. Its documented scope is low-level key management, address derivation, and signing; balance retrieval and transaction broadcast need separate blockchain-service integrations. Pin a reviewed release and verify its license, build provenance, audit scope, and supported Android ABI/API levels before adding it to the app.

## Required release gates

- Native Android host and wallet feature live inside the FundB Mining app package.
- Keystore-backed encryption verified on supported devices; fallback devices receive an accurate security warning.
- Recovery phrase never appears in HTTP requests, Appwrite records, logs, analytics, crash reports, backups, screenshots, or clipboard history.
- BIP-39 vectors and each supported chain's derivation/address vectors pass.
- Restore on a clean second device reproduces the same public addresses.
- Static analysis, dependency review, mobile security testing, and independent assessment completed.
- Mainnet transaction features remain disabled until all relevant tests and incident-response procedures are approved.

## Current state

The repository currently contains a browser-based PWA, not a native Android project. The existing wallet page remains a disabled placeholder. This plan does not mean the Android module, secure key generation, address derivation, or transaction flows have been implemented. No dashboard, profile, points, or referral records are changed by this plan.
