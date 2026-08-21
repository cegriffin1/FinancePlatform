# Campaign Growth Engine

## Objective

Support two ownership models without mixing lead ownership:

1. **ALTUS_PLATFORM_CAMPAIGN** — platform acquires → scores → distributes to eligible subscribers
2. **SUBSCRIBER_CAMPAIGN** — org acquires with own budget/branding → leads stay with org → internal routing

## Phase 1 (this branch)

- Domain types for campaigns, attribution, scoring breakdown, distribution, entitlements
- Additive SQL migration + RLS
- Campaign builder wizard (10 steps)
- Campaign template library UI
- Configurable scoring engine (fit / intent / engagement → temperature)
- Strategy classification service
- Lead distribution service (auditable, Premier preference with eligibility gates)
- Subscription entitlement service (STANDARD / PRO / PREMIER / ENTERPRISE)
- Mock channel providers (Meta, LinkedIn, Google, TikTok, Email, SMS)

## Explicit non-goals

- Live ad publishing
- Real OAuth social account connections
- Payments / pricing
- Autonomous budget changes
- Autonomous AI campaign publishing

## Funnel

```text
Campaign Creation → Channels (mocked) → Landing / Assessment
→ Lead Capture + Attribution → Scoring → Classification
→ Territory / License / Entitlement checks → Distribution or Owner routing
→ Assignment → CRM follow-up → Analytics
```

## Scoring defaults (configurable)

| Band | Min score |
| --- | --- |
| COLD | 0 |
| WARM | 40 |
| QUALIFIED | 60 |
| HOT | 80 |
| PRIORITY | 90 |

## Premier distribution rule

PRIORITY/HOT platform leads prefer PREMIER/ENTERPRISE candidates **only after** territory, strategy, license, and capacity filters pass. Tier alone is never sufficient.

## Next phases

2. Platform pool delivery, SLA, notifications  
3. Meta / LinkedIn / Google adapters  
4. Subscriber account connections + publish/sync  
5. Email/SMS + automation + AI assist (review-required)
