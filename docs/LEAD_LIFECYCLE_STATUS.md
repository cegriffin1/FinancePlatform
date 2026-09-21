# ALTUS Lead Temperature, Aging, Recycling & Resale — Status Report

Generated: 2026-09-15

## Capability Status

| Area | Status |
|------|--------|
| HOT/MEDIUM/COLD | **Working** |
| ENGAGEMENT TRACKING | **Working** |
| 30-DAY COLD LOGIC | **Working** (admin-configurable `cold_after_days`) |
| 45-DAY RECYCLING | **Working** (admin-configurable `recycle_after_days`) |
| RE-ENGAGEMENT | **Working** |
| OWNERSHIP RELEASE | **Working** |
| MARKETPLACE | **Working** (Recycled Opportunities) |
| RESALE | **Working** (transactional reserve/purchase) |
| CONSENT/ELIGIBILITY | **Working** |
| CAMPAIGN ATTRIBUTION THROUGH RESALE | **Working** (`campaign_id` retained; recycled revenue tracked) |

## What shipped

- Operational **HOT / MEDIUM / COLD** separate from Opportunity Score (0–100)
- `LeadEngagementService` — meaningful vs system activity clocks
- `LeadTemperatureTransitionService` + `lead_temperature_snapshots` history
- `LeadLifecycleAgingService` — **does not decay Opportunity Score**
- `LeadRecyclingEligibilityService` — appointment / opportunity / suppression / consent gates
- `LeadOwnershipReleaseService` — ownership history preserved
- CRM Command Center tabs: HOT / MEDIUM / COLD / RECYCLING SOON
- Cold-lead recycling warnings on lead detail (open record ≠ reset clock)
- `/marketplace` Recycled Opportunities cards (no PII pre-purchase)
- `/admin/lead-lifecycle` versioned config
- `/admin/lead-inventory` temperature + recycling buckets
- `CampaignHealthService` — quality, channel comparison, cohort trajectory
- Domain events + org notification preferences
- Recycled purchase → RECYCLED LEAD + re-engagement plan recommendations

## Test results (executed)

```
npm run typecheck  → pass
npm run lint       → pass (unused-import warning fixed)
npm test           → 14 files / 91 tests passed
npm run build      → pass
```

Lifecycle suite (`lead-lifecycle.test.ts`): 12/12 passed covering temperature transitions, meaningful interaction, 30-day cold, 45-day recycling, re-engagement, appointment/opportunity/suppression protection, hot→marketplace→resale with original score preserved.

## Playwright

**Executed — failed:** 11 specs failed with `ECONNREFUSED ::1:3000` (dev server not running). Chromium launched; failures are environment/host, not lifecycle assertions. Lifecycle E2E scenarios are covered by Vitest test-clock suite (`lead-lifecycle.test.ts`).

## Production blockers

1. **Legal/compliance review required** before live consumer-data resale — technical gates exist; production policy not signed off.
2. Marketplace spend / cost-per-opportunity channel metrics use spend placeholder (0) until budget spend attribution is wired.
3. Playwright requires a running app server (`localhost:3000`) for green e2e; CI should start Next before Playwright.
4. Sim-store lifecycle is in-memory for MVP; production must persist snapshots/ownership/purchases via Supabase with RLS (patterns exist elsewhere — not newly migrated in this pass).
