# Lead Intelligence — Events, Scoring, Classification, Lifecycle

## Event-driven timeline

Every lead has an append-only event timeline feeding CRM, analytics, scoring, attribution, AI, and future Dynamics sync.

Example:

```text
10:02 — campaign.clicked
10:03 — assessment.started
10:04 — question.answered (business_owner=yes)
10:05 — strategy.signal (tax_strategy)
10:06 — contact.submitted
10:07 — appointment.calendar_opened
10:08 — appointment.scheduled
10:08 — lead.score_increased
10:08 — lead.temperature_changed (HOT)
10:09 — lead.assigned
```

### Core event catalog (extensible)

Campaign clicked · Landing viewed · Assessment started · Question answered · Assessment completed · Contact submitted · Resource requested · Email opened · SMS interaction · Appointment calendar opened · Appointment scheduled · Scheduled within 24h / 72h · Confirmed · Attended · Missed · Follow-up response · Portal created · Document viewed · Opportunity created · Score changed · Temperature changed · Classification changed · Routed / assigned · Nurture entered · Recycle eligibility reviewed

## Behavior-based scoring

`LeadScoringService` evaluates **events + answers + appointment intent**, not questionnaire answers alone.

- Rules are configurable rule packs (core runtime + accelerator packs)
- Temperature thresholds (COLD / WARM / HOT / PRIORITY as defaults) are configurable — not permanently hard-coded
- Scoring values must never live in React components

Conceptual temperature progression:

```text
Contact captured → Lead
Assessment completed → ↑ score
Strategy fit → ↑ score
Appointment scheduled → significant ↑
Appointment ≤72h → may become HOT
Strong fit + immediate appointment → may become PRIORITY
```

## Strategy classification

`LeadClassificationService` attaches zero-to-many internal classifications:

- `strategy_category`
- `strategy_confidence`
- `classification_reason`
- `classification_version`

Not shown to consumers as advice.

## Appointment intent

Track on appointments / lead projection:

- `appointment_requested_at`
- `appointment_scheduled_for`
- `days_until_appointment`
- `appointment_status`
- attended / cancelled / rescheduled / no_show flags

Appointment timing influences score; scheduling alone does not guarantee a sale.

## Routing

`LeadRoutingService` considers (configurable): organization, agent, team, territory, state, licensing, strategy specialization, subscription level, temperature, capacity, availability, campaign ownership, existing relationship.

Territory/licensing:

- `agent_territories`, `agent_licenses`, `campaign_territories`, `lead_territory`, `routing_eligibility`
- Never auto-route to ineligible agents
- No regulatory determinations without validated configurable rules

## Lifecycle & nurture

`LeadNurtureService` and `LeadLifecyclePolicyService` support paths such as:

```text
NEW → CONTACTED → ENGAGED → APPOINTMENT_SCHEDULED → APPOINTMENT_COMPLETED → OPPORTUNITY → WON
NEW → CONTACTED → NO_RESPONSE → NURTURE → REENGAGED
APPOINTMENT_SCHEDULED → NO_SHOW → NURTURE → RESCHEDULED
```

Abandoned assessment / qualified-not-scheduled must be retained and may enter consented follow-up sequences.

## Recycling

Recycling is **policy-driven**, never “timer expired ⇒ sell.”

Factors: ownership period, contact attempts, last meaningful interaction, campaign/subscription terms, consent, org rules, compliance restrictions.

```text
Assigned → Active follow-up → Nurture → Dormant → Eligible for review → Eligible for recycling
```

## Provenance (immutable)

Preserve forever:

`original_campaign_id`, `original_organization_id`, `source`, `source_platform`, `source_ad`, `source_creative`, UTM fields, `captured_at`, `qualification_version`, `scoring_version`

Ownership/status changes must not overwrite provenance.

## Attribution funnel (analytics boundary)

```text
Ad Spend → Click → Assessment → Lead → Qualified Lead → Appointment → Opportunity → Closed → Revenue
```

Metrics: CPC, CPL, CPQL, cost/appointment, appointment rate, show rate, conversion, CPA, ROI, revenue/lead.
