# FundB Mining — Android preview host

This is a separate Android application shell around the existing FundB Mining PWA. It is intentionally isolated under `android/`; the website files, dashboard, Appwrite data and production-hardening branch are not modified by this work.

## Current scope

- Kotlin Android application using a WebView to display the existing HTTPS FundB PWA.
- WebView navigation is restricted to the configured FundB Pages hostname.
- External HTTP(S) links open outside the app.
- Cleartext traffic, file access, content access and mixed content are disabled.
- TLS certificate errors are rejected.
- No JavaScript-to-native bridge, wallet key storage, seed phrase handling, signing, deposits, transfers or withdrawals.

## Build

Open this `android/` directory in Android Studio with JDK 17 and Android SDK Platform 35 installed, then sync and build the `app` debug variant. CI also runs `gradle assembleDebug` on pull requests touching this directory.

## Important release notes

- Application ID `com.fundb.mining.preview` is a preview identity, not a confirmed Play Store release identity. Confirm the final package name before publishing.
- The app currently points to the existing production-hardening Pages hostname. A change to that endpoint must be reviewed and tested before release.
- This is a WebView host preview, not a native wallet or a Play Store-ready production release.
- Never add private keys, recovery phrases, Appwrite function keys, or other secrets to this repository.
- Real wallet functions require a separate security-reviewed implementation using Android Keystore and audited cryptographic libraries. The web page must not receive wallet secrets.
