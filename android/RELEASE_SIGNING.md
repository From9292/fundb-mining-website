# FundB Android release signing

The Android preview build and production release identity are deliberately separate. The preview package ID is `com.fundb.mining.preview`; it must not be published or used to replace a user's installed production app.

## Required repository configuration

Before running **FundB Android signed release candidate** in GitHub Actions, configure:

Repository variable:
- `FUNDB_RELEASE_APPLICATION_ID`: the final unique package ID selected for FundB's Google Play listing. It must not be the preview ID.

Repository secrets:
- `FUNDB_RELEASE_KEYSTORE_BASE64`: Base64-encoded contents of the owner-controlled Android upload/release keystore.
- `FUNDB_RELEASE_STORE_PASSWORD`
- `FUNDB_RELEASE_KEY_ALIAS`
- `FUNDB_RELEASE_KEY_PASSWORD`

Create and securely back up the keystore on a trusted device. Never commit the keystore, passwords, signing key, recovery material, or service-account credentials. Do not paste secrets into chat, issues, source files, or build logs. Keep an offline backup in a secure password manager or encrypted storage.

## Release gate

The manual workflow validates that the final package ID and all signing secrets exist, then builds a signed Android App Bundle. It deliberately does **not** upload to or publish through Google Play. The output is a release candidate requiring package-identity verification, device testing, privacy/data-safety review, policy checks, and Play Console review before any public release.

A signing key is part of the app's long-term identity. Losing it or changing it carelessly can prevent updates to an existing installation. Confirm the final package ID and signing ownership before the first public release.

## Current limitations

This workflow does not implement a native wallet, token transfer, cash withdrawal, AdMob reward verification, or independent security certification. Those must be completed and tested separately. Never describe preview points as cash or a live token.
