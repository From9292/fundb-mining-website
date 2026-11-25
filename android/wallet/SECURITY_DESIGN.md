# FundB Android wallet security boundary

Status: **design-only / wallet disabled**. This document is a security gate, not evidence that a wallet has been implemented or audited.

## Current application boundary

The Android preview is a WebView host for the existing FundB PWA. It is not a cryptocurrency wallet. The web page must never receive a private key, seed phrase, signing capability, or Android Keystore handle. The current app has no wallet key generation, import, signing, broadcast, deposit, transfer, swap, or withdrawal implementation.

The PWA's browser storage is not an acceptable location for wallet secrets. Appwrite and every other server may store public account metadata and non-secret preferences only; never recovery phrases, private keys, raw signing material, or unencrypted key backups.

## Required architecture before wallet code is enabled

1. **Separate native wallet module.** Keep wallet code outside the WebView and expose no JavaScript interface. The WebView may request a read-only public wallet summary through a narrowly scoped, reviewed interface only after a separate threat-model review.
2. **Local key creation.** Generate entropy on-device with the platform cryptographic random-number generator. Use a maintained, audited BIP-39 implementation with published test vectors. Do not invent mnemonic or key derivation code.
3. **Key protection.** Encrypt key material with a key protected by Android Keystore. Prefer hardware-backed TEE/StrongBox when available, detect and report the actual security level, and fail closed if the chosen security policy cannot be met. StrongBox availability must not be assumed. Do not silently downgrade to plaintext or browser storage.
4. **Backup and recovery.** Show the recovery phrase only in a deliberate, private, user-confirmed flow. Require a backup-verification step. Never transmit it, log it, put it in analytics/crash reports, or copy it to the clipboard automatically. Explain that losing the phrase can permanently lose access.
5. **Transaction construction.** Build transactions from verified chain-specific libraries and providers. Display network, asset, destination, amount, and estimated fee before user approval. Re-check chain identity and destination immediately before signing. No signing on behalf of the user.
6. **Network isolation.** Treat each chain as a separate implementation with its own chain ID, address validation, RPC/provider policy, fee logic, and test vectors. BNB Smart Chain is only a proposed first network; do not infer its mainnet/testnet configuration from a wallet address.
7. **Threat controls.** Consider rooted devices, overlays, screenshots, clipboard leakage, malicious deep links, compromised RPC endpoints, replay, chain-ID confusion, phishing, dependency compromise, and device loss. Define mitigations and residual risks before implementation.
8. **Independent review.** Require code review by a wallet/cryptography specialist, reproducible builds, dependency/SBOM review, test vectors, device tests, and an incident-response plan before enabling any real asset operation.

## Explicitly disabled until every gate is passed

- Creating or importing a live wallet
- Showing a receive address for real deposits
- Private-key or recovery-phrase export
- Signing or broadcasting transactions
- Sending, swapping, staking, bridging, or withdrawing assets
- Claiming that FUNDB has a market price or cash value

A wallet screen, address, balance, or transaction status must not be fabricated for demonstration. Use clearly labelled non-financial placeholders only.

## Release acceptance checklist

- [ ] Threat model and security design approved
- [ ] Audited cryptographic and chain libraries selected and pinned
- [ ] Android Keystore security level tested on supported devices
- [ ] Recovery and backup flow reviewed and tested
- [ ] Chain-specific address, transaction, and fee test vectors pass
- [ ] No secrets in WebView, browser storage, Appwrite, logs, analytics, backups, or crash reports
- [ ] Independent security review completed and findings resolved
- [ ] Release signing, privacy disclosures, support and incident response prepared

Passing CI or static source checks does not satisfy these gates and is not a security audit.
