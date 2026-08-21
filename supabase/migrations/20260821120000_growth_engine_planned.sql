-- DRAFT / PLANNED — Growth Engine additive schema
-- DO NOT treat this as an applied production migration until reviewed and scheduled.
-- Foundation migration 20260812090000_platform_foundation.sql must remain intact.
-- See docs/migration-plan-growth-engine.md

-- This file intentionally contains planning placeholders only.
-- Full CREATE TABLE statements will land in a dedicated schema feature branch.

/*
Planned additive tables (org-scoped + RLS):
  qualification_templates, qualification_questions, qualification_branches,
  qualification_sessions, qualification_answers,
  lead_events, lead_provenance, lead_score_snapshots, lead_temperature_states,
  lead_strategy_classifications, scoring_rule_packs, temperature_threshold_configs,
  agent_territories, agent_licenses, campaign_territories, routing_policies,
  lead_lifecycle_states, nurture_sequences, nurture_enrollments, lifecycle_policies,
  campaign_templates, subscription_plans, subscription_entitlements,
  organization_subscriptions, campaign_packages, lead_packages,
  accelerator_modules, organization_accelerators

Planned nullable columns on leads:
  temperature_key, lifecycle_status, qualification_session_id, score_version

Hard rule: no insurance-specific columns on core leads.
*/

select 1;
