# FundB Mining V2.1 + FundB Media preview

This package upgrades the existing FundB Mining V2.0 HTML source while preserving the existing Appwrite endpoint/project ID and authentication integration.

## Included in this upgrade
- FundB Points wording and refreshed welcome copy
- Proposed 10 FundB Points = $2 planning illustration, clearly marked non-cash/non-redeemable
- Expanded project whitepaper and conditional community airdrop explanation
- FundB Media language gate, local community-post preview, 100-level quiz progress preview, games/stream/call sections
- Revenue strategy: compliant ads, sponsorships, optional memberships, creator subscriptions/gifts and ticketed events
- Official Telegram and support email links

## Important: prototype limitations
The Media UI is a front-end preview. Global chat, friends, multiplayer games, live streaming, one-hour verified streaming rewards, audio/video calls, AI translation, payments, creator payouts and server-side FundB Points rewards are NOT connected. The preview does not issue the proposed 20-point game or 35-point streaming rewards. These require secure backend services, real-time infrastructure, provider integrations, moderation, payment configuration and server-side anti-fraud verification.

The proposed $2 reference is not a guaranteed price or cash value. A future airdrop, token launch, conversion ratio, exchange listing or reward amount is not guaranteed.

## Deployment
Upload `FundB_Mining_V2.1_Media_Upgrade.html` as `index.html` in your existing Netlify site, keeping your existing `assets/` folder, `manifest.webmanifest`, and `sw.js` alongside it. The original file's Appwrite project ID and endpoint are preserved. Test registration/login after deployment.

## Revenue compliance
Do not reward users for clicking or viewing ordinary AdSense ads. Use only ad formats/providers that explicitly permit incentivized rewarded placements. Keep non-incentivized ads separate from point earning. Configure payment, tax, creator verification, refund and user terms before accepting money.
