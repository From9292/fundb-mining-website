# FundB Mining — Android WebView host

This Android project is a thin native host for the existing FundB Mining Progressive Web App (PWA). The website, dashboard, Appwrite user records, referrals, and balances remain owned by the existing web application and backend.

## Current Android configuration

The current Gradle configuration defines:

- Application ID: `com.fundb.mining`
- Version name: `1.0.1`
- Version code: `3`
- Minimum Android SDK: `24`
- Target Android SDK: `35`
- Java/Kotlin target: `17`
- Web app origin: `https://fundb-production-hardening.fundb-mining-website.pages.dev/`

The Application ID above is the value currently in Gradle. It must be kept unchanged for updates to installs signed with the matching original signing key. Confirm it against the already-installed app and Play Console before any public Play Store release; do not change it casually.

## Current scope and security boundaries

- Kotlin Android application using a WebView to display the existing HTTPS FundB PWA.
- WebView navigation is restricted to the configured FundB Pages hostname.
- External HTTP(S) links open outside the app.
- Cleartext traffic, file access, content access, and mixed content are disabled.
- TLS certificate errors are rejected.
- No JavaScript-to-native bridge is exposed.
- No wallet private-key storage, seed phrase handling, transaction signing, deposits, transfers, or withdrawals are implemented in this Android host.
- The debug-only rewarded-ad panel uses Google's official test ad unit. It does not credit FundB points or start mining.
- A real reward-crediting flow requires server-side reward verification and a policy-compliant reward implementation. A client-side ad callback alone must never change a user's balance.

## Build and CI

Use JDK 17 and Android SDK Platform 35. From this directory:

```bash
gradle --no-daemon assembleDebug
```

GitHub Actions runs the preview/debug build and Android security smoke checks. The separate production release job builds both a signed APK and AAB only after all four repository Actions secrets are correctly configured:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

The Base64 secret must contain the complete Base64-encoded bytes of the original release keystore, not a command, filename, partial value, or a newly generated key. The workflow validates the encoded value and checks the keystore before attempting the release build.

## Release safeguards

- Preserve the original signing keystore and alias for continuity with existing signed installations and any future Play Console registration.
- Never commit a keystore, password, private key, recovery phrase, Appwrite function key, or other secret to this repository.
- Do not distribute a debug/preview APK as the production release.
- A successful build is not by itself proof that the app's wallet, mining, or rewards are production-ready. Those features require their own backend, security, policy, and end-to-end verification.
- Real wallet functions require a separate security-reviewed implementation using Android Keystore and audited cryptographic libraries. The web page must not receive wallet secrets.
