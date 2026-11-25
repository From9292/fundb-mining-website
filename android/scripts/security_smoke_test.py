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
    activity_path = ROOT / "app/src/main/java/com/fundb/mining/preview/MainActivity.kt"
    gradle_path = ROOT / "app/build.gradle.kts"

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

    gradle = gradle_path.read_text(encoding="utf-8")
    require(re.search(r"minSdk\s*=\s*23", gradle) is not None,
            "Unexpected minimum Android SDK")
    require(re.search(r"targetSdk\s*=\s*35", gradle) is not None,
            "Target SDK must remain explicitly configured")

    print("FundB Android static safety checks: PASS")
    print("Scope: manifest permissions, network policy, WebView boundaries, TLS handling, SDK levels")
    print("Note: static checks do not replace device testing or an independent security review.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (AssertionError, OSError, ET.ParseError) as error:
        print(f"FundB Android static safety checks: FAIL: {error}", file=sys.stderr)
        raise SystemExit(1)
