# LinkedIn Ads Integration

## Env (names only)

```
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
LINKEDIN_REDIRECT_URI=
LINKEDIN_WEBHOOK_SECRET=
```

## Overview

`LinkedInAdsProvider` normalizes LinkedIn Campaign Manager operations into ALTUS domain types.

Capability-aware UI only shows company size, industry, and job seniority when the connected account supports them.

## LIVE requirements

- LinkedIn Marketing Developer Platform application
- Advertising account access
- OAuth scopes for campaign management and lead forms (as approved)

## Webhooks

`POST /api/webhooks/linkedin` — signature verified when secret is configured.

## Sandbox

Default SIMULATION mode connects a mock advertising account without live credentials.
