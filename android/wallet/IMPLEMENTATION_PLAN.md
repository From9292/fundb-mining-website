# FundB wallet implementation plan

Status: **planning only — no real-asset wallet functionality is enabled**.

This plan deliberately separates the existing FundB account/rewards service from a future wallet. Existing Appwrite accounts, points, referral relationships and mission records must remain untouched by wallet development.

## 1. Product and custody decision

The current Android app is a WebView preview. It is not a wallet and must not be described as one.

Recommended direction: **non-custodial, native Android wallet**. Each user controls their own signing keys on their device. FundB servers must never receive or store recovery phrases, private keys, raw signing material, or unencrypted backups. Do not implement platform-held custody without a separate legal/compliance decision, specialist architecture, operational controls and independent audit.

FundB Points are not wallet assets, cash, or a redeemable token. Do not mix points, user assets, and business revenue in one balance or ledger.

## 2. Delivery stages

### Stage A — requirements and threat model
- Define supported countries, age requirements, user disclosures, support and incident response.
- Select the first chain and asset only after confirming product need, chain ID, address format, fees, reliable RPC providers and legal availability.
- Document attacker capabilities: compromised/rooted device, malicious apps/overlays, phishing, clipboard/screenshot leakage, malicious RPC, replay, chain confusion, lost device, account takeover and supply-chain compromise.
- Define recovery limitations and user responsibility in plain language.
- Obtain specialist review of the architecture before key-handling code is written.

Exit gate: approved threat model, chain scope, product disclosures and jurisdiction review.

### Stage B — native security foundation (no funds)
- Keep wallet implementation in a separate native Kotlin module, outside the WebView.
- Do not expose a JavaScript interface, Keystore object, signing API or secret material to the WebView.
- Pin a maintained wallet/cryptography dependency only after reviewing its provenance, license, maintenance, security history and test vectors.
- Use Android platform CSPRNG and Android Keystore; detect hardware-backed security level and fail closed according to the approved policy.
- Define encrypted local storage, screen privacy, app-lock/session policy, backup exclusions, log redaction and secure deletion behavior.
- Add unit, instrumentation, emulator and physical-device tests. Do not silently downgrade protection on unsupported devices.

Exit gate: security review of module boundary, dependency selection, Keystore behavior and device test matrix.

### Stage C — testnet wallet lifecycle
- Generate/import keys only within the native module, using reviewed libraries and published test vectors.
- Implement recovery phrase display only in a deliberate private flow; require backup verification. Never send, log, analyze, automatically copy or include secrets in crash reports.
- Derive and display a public testnet address with explicit network labeling.
- Implement testnet-only transaction construction, fee estimation, transaction preview, user confirmation, signing and broadcast.
- Re-check chain ID, destination, asset, amount and fee immediately before signing.
- Add cancellation, timeout, duplicate-submit and pending/failed/confirmed state handling.

Exit gate: repeatable testnet end-to-end tests, recovery tests, negative tests, and independent code review. No mainnet funds.

### Stage D — production readiness
- Complete independent wallet/cryptography audit and resolve all critical/high findings.
- Complete reproducible release build, dependency/SBOM and signing-key procedures, device compatibility testing, privacy review, support and incident-response exercises.
- Confirm legal/compliance and provider requirements for each launch jurisdiction.
- Establish a documented security update and vulnerability disclosure process.
- Keep mainnet disabled until every gate is approved.

Exit gate: written approval from product, legal/compliance and independent security reviewers.

### Stage E — limited mainnet rollout
- Start with one explicitly supported network and a small opt-in cohort only after all prior gates pass.
- Display clear network/asset labels, fees, irreversible-transfer warnings and support contact.
- Monitor reliability and security without collecting secrets. Provide an emergency disable mechanism for app-side transaction initiation that does not falsely claim it can reverse on-chain transfers.
- Expand countries and networks only after separate compatibility and legal reviews.

## 3. Required security invariants

- No seed phrase/private key in Appwrite, browser storage, WebView, analytics, telemetry, logs, support tickets or Git.
- No server-side signing or hidden transaction execution.
- No fake addresses, balances, confirmations, token prices or withdrawal claims.
- No user asset balance may be counted as FundB revenue or owner funds.
- No points may be described as cash or redeemable unless a separate lawful, funded program is approved.
- No chain may share assumptions about chain ID, address validation, fees or RPC trust with another chain.
- Every transaction must be explicitly reviewed and approved by the user on-device.
- Wallet failures must fail closed; never silently substitute another network or asset.

## 4. Test matrix before release

- Published cryptographic vectors and deterministic derivation tests.
- Invalid/malformed recovery phrase and wrong-passphrase cases.
- Keystore invalidation, device lock, app reinstall, backup/restore and unsupported hardware cases.
- Wrong chain ID, wrong network, malformed address, token decimal, fee spike and RPC outage cases.
- Transaction mutation between preview and signing, replay, duplicate submission and broadcast timeout cases.
- Overlay/phishing, clipboard, screenshot, log and crash-report leakage checks.
- Rooted/compromised device policy and minimum supported Android version tests.
- Accessibility, localization, low-bandwidth and international date/number formatting tests.
- Independent review findings tracked to closure.

## 5. Current status

- Android WebView preview only.
- Wallet key generation/import: not implemented.
- Recovery: not implemented.
- Real receive addresses: not implemented.
- Signing/broadcast/send/withdraw/swap: not implemented.
- Mainnet support: not enabled.
- Independent wallet audit: not completed.

A successful Android APK build or static CI check is not evidence that custody is safe, a wallet is implemented, or a release is approved.
