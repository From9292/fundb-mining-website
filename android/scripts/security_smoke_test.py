#!/usr/bin/env python3
"""Static safety regression checks for the FundB Android preview host.

These checks protect the deliberately limited WebView wrapper. They are not
a penetration test, cryptographic audit, or proof of runtime security.
"""
from pathlib import Path
import re
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
ANDROID_NS = "{http://schemas.android.com/apk/res/android}"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> int:
    manifest_path = ROOT / "app/src/main/AndroidManifest.xml"
    activity_path = ROOT / "app/src/main/java/com/fundb/mining/MainActivity.kt"
    gradle_path = ROOT / "app/build.gradle.kts"
    wallet_policy_path = ROOT / "wallet/SECURITY_DESIGN.md"

    manifest = ET.parse(manifest_path).getroot()
    permissions = {
        node.attrib.get(ANDROID_NS + "name")
        for node in manifest.findall("uses-permission")
    }
    require(permissions == {"android.permission.INTERNET"},
            f"Unexpected Android permissions: {sorted(permissions)}")

    app = manifest.find("application")
    require(app is not None, "Manifest application element is missing")
    require(app.attrib.get(ANDROID_NS + "allowBackup") == "false",
            "Android backup must remain disabled")
    require(app.attrib.get(ANDROID_NS + "usesCleartextTraffic") == "false",
            "Cleartext network traffic must remain disabled")
    require(app.attrib.get(ANDROID_NS + "debuggable") != "true",
            "Do not enable debuggable in the manifest")
    require(app.attrib.get(ANDROID_NS + "icon") == "@mipmap/ic_launcher",
            "FundB launcher icon must be declared in the manifest")
    icon_path = ROOT / "app/src/main/res/mipmap-anydpi/ic_launcher.xml"
    adaptive_icon_path = ROOT / "app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml"
    foreground_path = ROOT / "app/src/main/res/drawable/ic_launcher_foreground.xml"
    require(icon_path.is_file() and adaptive_icon_path.is_file()
            and foreground_path.is_file(),
            "Legacy and adaptive FundB launcher icon resources must exist")
    adaptive_icon = ET.parse(adaptive_icon_path).getroot()
    require(adaptive_icon.tag == "adaptive-icon",
            "Android 8+ launcher icon must use an adaptive-icon resource")

    activity = app.find("activity")
    require(activity is not None, "Launcher activity is missing")
    require(activity.attrib.get(ANDROID_NS + "exported") == "true",
            "Launcher activity must explicitly declare exported=true")
    actions = {
        node.attrib.get(ANDROID_NS + "name")
        for node in activity.findall("./intent-filter/action")
    }
    categories = {
        node.attrib.get(ANDROID_NS + "name")
        for node in activity.findall("./intent-filter/category")
    }
    require(actions == {"android.intent.action.MAIN"}
            and categories == {"android.intent.category.LAUNCHER"},
            "Only the standard launcher intent should be declared")

    source = activity_path.read_text(encoding="utf-8")
    require('uri.scheme == "https" && uri.host == appHost' in source,
            "Only the exact HTTPS FundB host may load inside the WebView")
    require("SslErrorHandler" in source and "handler.cancel()" in source,
            "TLS errors must be rejected")
    require("handler.proceed()" not in source,
            "TLS errors must never be bypassed")
    require("WebSettings.MIXED_CONTENT_NEVER_ALLOW" in source,
            "Mixed content must remain blocked")
    require("allowFileAccess = false" in source
            and "allowContentAccess = false" in source,
            "WebView file and content access must remain disabled")
    require("addJavascriptInterface" not in source,
            "Do not expose a JavaScript-to-native bridge")
    require("Intent.ACTION_VIEW" in source,
            "External web links must be handed to the Android browser")
    require("https://" in source,
            "The configured app origin must use HTTPS")

    # Wallet remains design-only: no keys, mnemonics, or signing APIs may
    # accidentally appear in the WebView host while the wallet is disabled.
    for forbidden in ("PrivateKey", "SecretKey", "Mnemonic", "signTransaction", "eth_sendRawTransaction"):
        require(forbidden not in source,
                f"Wallet functionality is not approved in the WebView host: {forbidden}")
    require(wallet_policy_path.is_file(),
            "Wallet security design and release gates must be documented")
    wallet_policy = wallet_policy_path.read_text(encoding="utf-8")
    for required in ("design-only / wallet disabled", "Android Keystore",
                     "Never transmit it", "Independent review",
                     "Explicitly disabled until every gate is passed"):
        require(required in wallet_policy,
                f"Wallet security policy is missing required safeguard: {required}")

    gradle = gradle_path.read_text(encoding="utf-8")
    require(re.search(r"minSdk\s*=\s*24", gradle) is not None,
            "Minimum Android SDK must remain 24 for Google Mobile Ads compatibility")
    require(re.search(r"targetSdk\s*=\s*35", gradle) is not None,
            "Target SDK must remain explicitly configured")

    print("FundB Android static safety checks: PASS")
    print("Scope: manifest permissions, launcher icon, network policy, WebView boundaries, TLS handling, SDK levels, wallet-disabled policy")
    print("Note: static checks do not replace device testing or an independent security review.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (AssertionError, OSError, ET.ParseError) as error:
        print(f"FundB Android static safety checks: FAIL: {error}", file=sys.stderr)
        raise SystemExit(1)
