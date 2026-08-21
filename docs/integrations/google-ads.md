# Google Ads Integration

## Env (names only)

```
GOOGLE_ADS_CLIENT_ID=
GOOGLE_ADS_CLIENT_SECRET=
GOOGLE_ADS_DEVELOPER_TOKEN=
GOOGLE_ADS_REDIRECT_URI=
GOOGLE_ADS_WEBHOOK_SECRET=
```

## Overview

`GoogleAdsProvider` focuses on **Search** campaigns initially.

Extensible subtypes: `search`, `display`, `video`, `performance_max`.

## LIVE requirements

- Google Cloud OAuth client
- Google Ads developer token
- Linked Ads customer / MCC access

## Capabilities

- Keywords + match types
- Headlines / descriptions
- Geography + daily budget
- Status pause/resume + metrics sync

## Sandbox

SIMULATION mode publishes normalized external IDs without calling Google Ads API.
