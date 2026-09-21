# Campaign Funnel

## Canonical path

**Ad click → Interactive Assessment (immediately) → Data capture → Contact → Score → Setter → CRM**

There is **no** separate marketing landing page, long sales page, or CRM form wall between the ad and the assessment.

Public route `/c/[organizationSlug]/[campaignSlug]` loads the assessment experience directly and creates an `AssessmentSession` with attribution on entry.

## Stages

ABOUT YOU → YOUR MONEY → YOUR GOAL → dynamic branch → YOUR PRIORITIES → YOUR PLAN → CONTACT → consumer result

## Attribution

Captured at session create (not deferred until Q24): campaign_id, UTMs, provider, external ad ids, referrer, first_touch_at.

## Analytics funnel

Campaign clicks → Assessment starts → About You → Your Money → $250K+ identified → Goal → Priorities → Contact → Qualified → Setter verified → Appointment → Opportunity

Primary KPI remains **Cost Per Qualified Opportunity**.

Incomplete sessions are **not** contactable leads.
