# AI Future State

## Principle

Prepare clean event/data boundaries for future AI. Do **not** implement autonomous financial recommendations.

## Future capabilities (assistive only)

- Explain why a lead scored highly (from events + rule pack reasons)
- Recommend next action (call, nurture, reschedule)
- Detect stalled opportunities
- Suggest follow-up copy/timing (human-approved send)
- Recommend campaign optimization hypotheses
- Predict appointment / conversion probability
- Identify high-performing audiences
- Generate campaign variations for human review

## Required inputs (already architected)

- Append-only `lead_events`
- Immutable `lead_provenance`
- Score snapshots + temperature history
- Strategy classifications with reasons/versions
- Campaign attribution funnel metrics
- Consent / communication preferences

## Guardrails

- No autonomous advice to consumers about financial products
- No silent redistribution or pricing decisions by AI
- Outputs are suggestions behind entitlements and audit logs
- Copilot / Azure Functions may consume the same domain events via adapters later
