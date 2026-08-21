# Monetization & Marketplace Architecture

## Principle

Do **not** implement payments in this milestone. Define abstractions so multiple models can coexist.

## Monetization models (future)

| Model | Description |
| --- | --- |
| Monthly subscription | Platform access + lead-generation capabilities |
| Campaign package | Budget → target lead qty → territory → strategy |
| Lead package | Purchase eligible lead packages |
| Hybrid | Subscription + campaign budget + premium lead access |

Prices are never hard-coded in application code.

## Core abstractions

- `SubscriptionPlan`
- `SubscriptionEntitlement`
- `CampaignPackage`
- `LeadPackage`
- `BillingProvider` (Stripe/etc. later — interface only)

## Lead access tiers (configurable)

Conceptual defaults: STANDARD · PRO · PREMIUM · ENTERPRISE

Higher tiers may unlock volume, territories, strategies, priority routing, analytics, automation, team features.

Do **not** implement artificial or misleading lead-quality guarantees.

## Future lead marketplace

Architect only — do not fully implement.

Orgs may purchase inventory by territory, industry, strategy, age, qualification, engagement.

Potential objective categories (event/score based — never marketing fluff):

- Fresh Priority
- Fresh Qualified
- Nurture
- Aged

Every category must map to objective system events and scoring rules. Provenance is preserved across any redistribution.

Advanced Markets may contribute marketplace **rules overlays**; marketplace itself is a separate future module (see [platform-layers.md](./platform-layers.md)).
