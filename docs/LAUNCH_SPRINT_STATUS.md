# ALTUS 14-Day Launch Sprint — Status Report

Branch: `feature/mvp-retirement-crm`

## Capability matrix

| Area | Status |
|------|--------|
| ADMIN CAMPAIGN JOURNEY | **Working** (8-step guided wizard) |
| CAMPAIGN PREVIEW | **Working** (iframe preview of homepage assessment) |
| CAMPAIGN LAUNCH | **Simulation** (explicit LAUNCH; no real spend) |
| PROSPECT JOURNEY | **Working** |
| HOMEPAGE ASSESSMENT | **Working** |
| 24-POINT DATA CAPTURE | **Working** |
| DYNAMIC BRANCHING | **Working** |
| SESSION RECOVERY | **Working** |
| ATTRIBUTION | **Working** |
| SCORING | **Working** |
| HOT/MEDIUM/COLD | **Working** |
| ADMIN LEAD EXPERIENCE | **Working** |
| APPOINTMENT JOURNEY | **Partial** (CTA + CRM paths exist; calendar depth thin) |
| CAMPAIGN HEALTH | **Working** (KPI row + health + funnel) |
| MOBILE | **Partial** (assessment + wizard touch targets; full QA pending) |
| ACCESSIBILITY | **Partial** (labels/focus/icons+text; full audit pending) |

## What shipped this pass

- `/app/campaigns/new` → `LaunchCampaignWizard` (Goal→Channels→Audience→Creative→Budget→Experience→Review→Launch)
- Draft auto-save (local + `save_draft` API)
- Preview Experience modal (no production traffic)
- Simulation launch with per-channel LIVE/FAILED + Retry TikTok
- Success screen with next actions + “What happens next”
- Campaign detail executive KPIs, health scores, live funnel, leads empty state
- Admin home: action cards, Needs Attention, Create Campaign CTA
- Assessment intro copy tightened for ad traffic
- Analytics event sink `/api/analytics/event`

## Tests (executed)

```
npm run typecheck  → pass
npm run lint       → pass (after unused type fix)
npm test           → 14+ files / 91+ tests (prior) + launch-sprint suite
npm run build      → pass
Playwright         → BLOCKED on this host (macOS 12 arm64: Playwright Chromium unsupported)
```

Playwright specs exist: `e2e/campaign-launch-wizard.spec.ts`, `e2e/homepage-take-assessment.spec.ts`.
Run on CI Linux or macOS 13+.

## Blockers

1. Playwright browsers cannot install on macOS 12 arm64 — e2e must run in CI.
2. Live ad spend / real OAuth publish still simulation-gated (intentional for launch demo).
3. Appointment scheduling UX is CTA-level; full calendar booking polish remains.
4. Lifecycle + campaign data still primarily sim-store; production Supabase persistence for wizard drafts needed before true multi-device admin.
5. Full mobile/a11y responsive QA (1440→390) not fully signed off manually in this pass.

## Top 10 — tomorrow (launch-critical only)

1. CI Playwright job (Linux) for admin wizard + homepage assessment golden paths
2. Wire real Meta/LinkedIn connection status into wizard (not hardcoded connected)
3. Persist campaign drafts to Supabase with tenant RLS
4. Mobile QA pass: wizard steps + assessment cards at 390px
5. Accessibility pass: focus order, progress ARIA, contrast on health/temp
6. Harden double-submit locks across contact + launch (idempotent keys)
7. Hot-lead urgent notification polish on agent home
8. Appointment CTA → confirmed booking path E2E
9. Campaign → lead bidirectional drill-down deep links verification
10. Production observability: structured logs for publish/assessment failures
