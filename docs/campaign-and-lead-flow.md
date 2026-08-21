# Campaign and Lead Flow

## Product journey

```text
Marketing → Campaign → Interactive Qualification → Lead Capture → Lead Intelligence
→ Lead Scoring → Lead Classification → Appointment → Lead Routing → Agent/Advisor
→ CRM → Follow-Up → Opportunity → Closing → Retention → Referral
```

## Campaign → lead journey (expanded)

```mermaid
sequenceDiagram
  participant Prospect
  participant Campaign
  participant Qual as Qualification Engine
  participant Events as Lead Events
  participant Score as LeadScoringService
  participant Class as LeadClassificationService
  participant Route as LeadRoutingService
  participant Agent

  Prospect->>Campaign: Click ad / landing
  Campaign->>Events: campaign.clicked
  Prospect->>Qual: Start Stage 1 (3–5 questions)
  Qual->>Events: assessment.started / question.answered
  Prospect->>Qual: Submit contact
  Qual->>Events: contact.submitted + create lead + provenance
  alt Abandon before schedule
    Qual->>Events: abandoned / qualified_not_scheduled
    Qual->>Qual: Enroll nurture if consented
  else Schedule appointment
    Prospect->>Events: appointment.scheduled
  end
  Events->>Score: Evaluate rule packs
  Score->>Class: Classify strategies
  Class->>Route: Route with eligibility
  Route->>Agent: Assign lead
  Agent->>Events: activities / follow-up
```

## Lead routing flow

```mermaid
flowchart LR
  A[Lead + events] --> B[Score + temperature]
  B --> C[Strategy classifications]
  C --> D{Routing policy}
  D --> E{Territory / license eligible?}
  E -->|No| F[Hold / pool / manager]
  E -->|Yes| G[Assign agent / team]
  G --> H[Agent workspace]
  H --> I[Nurture or pipeline]
```

## Campaign catalog (accelerator-supplied templates)

Org selects growth objective (e.g. Tax Strategy, Business Owner Planning, Executive Benefits, Estate, Retirement, General Protection) then configures:

Campaign + Territory + Audience + Budget + Lead target + Qualification profile → campaign configuration from reusable templates.

## Foundation vs next builds

| Capability | Status |
| --- | --- |
| Core tables + RLS | Foundation ✅ |
| Domain intelligence interfaces | Architecture branch ✅ |
| Stage 1 runtime + AM pack | Planned |
| Scoring/routing engines | Interfaces + stubs; rules later |
| Marketplace / payments | Abstracted only |
