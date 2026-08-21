# META_APP_ID=
# META_APP_SECRET=
# META_REDIRECT_URI=
# META_WEBHOOK_SECRET=

## Overview

Meta (Facebook + Instagram) advertising is connected through `MetaAdsProvider`.

In **SIMULATION** mode (default), OAuth is mocked and campaigns publish to in-memory external IDs.

## Required developer setup (LIVE)

1. Create a Meta App with Marketing API access.
2. Configure OAuth redirect to `META_REDIRECT_URI`.
3. Request ads_management / leads_retrieval permissions as needed.
4. Configure webhook endpoint: `/api/webhooks/meta` with `META_WEBHOOK_SECRET` or app secret.

## Scopes (typical)

- `ads_management`
- `ads_read`
- `leads_retrieval`
- `pages_show_list` / `pages_read_engagement` when Page selection is required

## Entity mapping

| ALTUS | Meta |
| --- | --- |
| Campaign | Campaign |
| Channel config / audience+territory | Ad Set |
| Creative | Ad Creative / Ad |

Facebook and Instagram placements share one Meta campaign.

## Sandbox

Use `PROVIDER_MODE=SIMULATION`. Automated tests never call live Meta APIs.

## Production enablement

1. Set credentials in a secret manager (not Git).
2. Set `PROVIDER_CREDENTIAL_ENCRYPTION_KEY`.
3. Set `PROVIDER_MODE=LIVE` and `ALLOW_LIVE_AD_PUBLISH=true` only after approval.
4. Verify webhook signatures before processing leads.
