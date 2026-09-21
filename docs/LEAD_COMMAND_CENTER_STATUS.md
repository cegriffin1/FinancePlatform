# ALTUS — Lead Command Center + Speed-to-Lead Status

Branch: `feature/mvp-retirement-crm`

## Capability matrix

| Area | Status |
|------|--------|
| LEAD COMMAND CENTER | **Working** |
| HOT/MEDIUM/COLD | **Working** |
| OPPORTUNITY SCORE | **Working** |
| NEXT BEST ACTION | **Working** |
| SPEED-TO-LEAD | **Working** |
| SLA | **Working** (configurable HOT 15m / MEDIUM 60m / COLD 1d) |
| AUTO ASSIGNMENT | **Working** (existing + reason + unassigned attention) |
| SETTER WORKSPACE | **Working** (NEW→FOLLOW-UP queues) |
| PRE-CALL BRIEF | **Working** |
| ACTIVITY TIMELINE | **Partial** (events exist; richer formatting later) |
| APPOINTMENTS | **Partial** (setter schedule path exists) |
| CAMPAIGN ATTRIBUTION | **Working** |
| LEAD AGING | **Working** |
| RECYCLING | **Working** |
| MOBILE | **Partial** (cards + sticky CALL/TEXT/SCHEDULE) |
| SECURITY | **Partial** (sim-store + role headers; RLS patterns elsewhere) |

## Shipped

- `/app/leads` (+ `/leads` alias) Command Center: tabs, Needs Attention, sort, views, filters, desktop table + mobile cards
- `SpeedToLeadService` + config on sim store
- `NextBestActionService` with deterministic reasons
- Enhanced `PreCallBriefService`
- Lead detail command view: actions, NBA, follow-up panel, retirement summary, acquisition drillback
- Hot lead `NEW HOT OPPORTUNITY` notifications
- Assignment reason + routing attention for unassigned
- Setter workspace queues
- Admin live opportunities feed

## Tests (executed)

```
typecheck → pass
lint      → pass
vitest    → 16 files / 100 tests pass
build     → (running/pass in gate)
Playwright → blocked on macOS 12 arm64 Chromium
```

## Blockers

1. Playwright host OS limitation
2. Live telephony/SMS providers not connected (device deep-links only)
3. Sim-store authorization not full Supabase RLS for leads list
4. Appointment calendar polish still thin
5. Activity timeline UX still event-dump style

## Tomorrow's top 10 (launch-critical)

1. CI Playwright golden path: assessment → HOT → Command Center → follow-up → appointment
2. Supabase persistence for speed_to_lead + SLA history with RLS
3. Real agent capacity/licensing assignment UI for manual assign
4. Mobile QA 390px: Command Center + lead detail follow-up panel
5. Accessibility: table headers, SLA text, temperature icons+labels
6. Wire campaign KPI clicks with query params end-to-end
7. Meaningful-interaction taxonomy audit across setter + CRM
8. Appointment confirmed success screen polish
9. Tenant-scoped lead list API (no cross-org leakage)
10. Observability: structured logs for SLA breach + hot alerts
