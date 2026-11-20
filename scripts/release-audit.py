from pathlib import Path
import re
import xml.etree.ElementTree as ET

ROOT = Path(".")
CANONICAL = "https://fundb-production-hardening.fundb-mining-website.pages.dev"
PUBLISHER = "pub-9800579782167167"

required_pages = [
    "index.html",
    "about.html",
    "privacy.html",
    "terms.html",
    "community-guidelines.html",
]
for name in required_pages:
    path = ROOT / name
    if not path.is_file() or not path.read_text(encoding="utf-8").strip():
        raise SystemExit(f"Required public page is missing or empty: {name}")

index = (ROOT / "index.html").read_text(encoding="utf-8")
if f"ca-{PUBLISHER}" not in index:
    raise SystemExit("AdSense publisher meta tag does not match the configured publisher ID")

ads = (ROOT / "ads.txt").read_text(encoding="utf-8")
expected_ads_line = f"google.com, {PUBLISHER}, DIRECT, f08c47fec0942fa0"
if expected_ads_line not in [line.strip() for line in ads.splitlines()]:
    raise SystemExit("ads.txt is missing the exact configured publisher record")

robots = (ROOT / "robots.txt").read_text(encoding="utf-8")
if f"Sitemap: {CANONICAL}/sitemap.xml" not in robots:
    raise SystemExit("robots.txt sitemap URL does not match the production canonical host")

sitemap_path = ROOT / "sitemap.xml"
tree = ET.parse(sitemap_path)
ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
locations = [node.text or "" for node in tree.findall(".//sm:loc", ns)]
if not locations:
    raise SystemExit("sitemap.xml contains no locations")

required_urls = {
    f"{CANONICAL}/",
    f"{CANONICAL}/about.html",
    f"{CANONICAL}/privacy.html",
    f"{CANONICAL}/terms.html",
    f"{CANONICAL}/community-guidelines.html",
}
if not required_urls.issubset(set(locations)):
    missing = sorted(required_urls - set(locations))
    raise SystemExit("sitemap.xml is missing required canonical pages: " + ", ".join(missing))

for url in locations:
    if not url.startswith(CANONICAL + "/") and url != CANONICAL:
        raise SystemExit(f"sitemap.xml contains a non-canonical host: {url}")
    path = url.removeprefix(CANONICAL).lstrip("/")
    target = ROOT / (path or "index.html")
    if not target.is_file():
        raise SystemExit(f"sitemap.xml points to a missing local file: {url}")

print("Release audit passed: public policy pages, AdSense publisher consistency, robots.txt and canonical sitemap.")
