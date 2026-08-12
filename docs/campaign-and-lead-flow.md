# Campaign and Lead Flow

## Target vertical slice

```text
Organization signup
→ Organization setup
→ Invite employee
→ Employee joins organization
→ Create campaign
→ Publish landing page
→ Business owner completes interactive assessment
→ Lead is created
→ Lead is scored
→ Lead is assigned
→ Employee sees lead
→ Employee adds note/task
→ Employee moves lead through pipeline
```

## Campaign → lead journey

```mermaid
sequenceDiagram
  participant Owner as Org Owner
  participant Mkt as Marketing User
  participant Site as Landing Page
  participant Prospect as Prospect
  participant Score as LeadScoringService
  participant Route as LeadRoutingService
  participant Rep as Sales / Employee

  Owner->>Owner: Signup + org setup
  Owner->>Rep: Invite employee (joins)
  Mkt->>Mkt: Create campaign
  Mkt->>Site: Publish landing page
  Prospect->>Site: Complete assessment
  Site->>Site: Create lead + contact
  Site->>Score: Score lead
  Score->>Route: Scored lead
  Route->>Rep: Assign lead
  Rep->>Rep: Add note / task
  Rep->>Rep: Advance pipeline stage
```

## Lead routing flow

```mermaid
flowchart LR
  A[Lead created] --> B{Scoring}
  B --> C[Score + grade]
  C --> D{Routing rules}
  D -->|Own book| E[Assign to creator/owner]
  D -->|Round robin| F[Assign to team queue]
  D -->|Manager review| G[Assign to manager]
  E --> H[Assignee workspace]
  F --> H
  G --> H
  H --> I[Activities / Tasks]
  I --> J[Pipeline stage updates]
```

## Foundation vs deferred

| Capability | This milestone | Later |
| --- | --- | --- |
| Campaign / lead / opportunity tables | Schema + interfaces | Full UX |
| `LeadScoringService` | Interface + stub | Rules engine |
| `LeadRoutingService` | Interface + stub | Configurable routing |
| Landing pages / assessments | Out of scope | Feature branch |
| Pipeline UI | Placeholder nav | Feature branch |

## Data touchpoints

- `campaigns` — source of acquisition
- `leads` — qualified interest records
- `contacts` — people associated with leads/customers
- `opportunities` — monetized pipeline records
- `activities` / `tasks` — working the lead
- `pipelines` / `pipeline_stages` — progression model
