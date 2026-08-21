# Lead Intelligence Engine

Multidimensional Lead Intelligence Profile replaces single-score thinking.

## Flow

Capture → Quality Gate → Identity → Validation → Scores → Grade → NBA → Route → SLA → Outcome → Campaign Quality → Optimization recommendations

## Key services

- `LeadQualityGateService`
- `LeadIdentityResolutionService`
- `ContactValidationProvider` (returns `NOT_VERIFIED` without a live provider)
- `LeadIntelligenceScoringService` + priority policy
- `NextBestActionService`
- `LeadSlaService`
- `CampaignQualityService` / `CampaignOptimizationService`
- `AssessmentDecisionEngine` (progressive questions)

## UI

- `/app/leads` Lead Command Center
- `/app/leads/[id]` Pre-call brief + outcomes
- `/app/analytics/lead-quality`
- `/app/admin/lead-quality`

Scores are explainable and versioned. Historical snapshots are retained.
