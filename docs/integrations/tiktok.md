# TikTok Connected Accounts

## Overview

TikTok appears as a Connected Accounts card in ALTUS Marketing.

In **SIMULATION**, connect stores an org-scoped sealed credential reference for UI and tenant isolation tests.

## LIVE requirements (not activated)

1. Create a TikTok developer application.
2. Request products separately:
   - **Content Posting API** — organic publish
   - **Marketing API** — advertising / reporting
3. Configure `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_REDIRECT_URI`.
4. Complete TikTok app review / advertiser verification as required.
5. Implement token exchange + refresh before enabling LIVE.

## Explicit non-goals today

- No live TikTok OAuth redirects while `PROVIDER_MODE=SIMULATION`
- No organic publish
- No ad spend
- No lead import from TikTok
