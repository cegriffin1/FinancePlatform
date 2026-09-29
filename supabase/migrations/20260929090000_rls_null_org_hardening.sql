-- ALTUS — RLS NULL-org hardening (additive; policy-only)
-- After: 20260929080000_supabase_api_role_grants.sql
--
-- Goal: encode tenant ownership in RLS so isolation does not depend on
-- restrictive authenticated GRANTs alone.
--
-- Preserves intentional global SELECT catalogs:
--   roles, assessment_templates, campaign_templates
--   (+ assessment_questions via global template membership)
--
-- Hardens TENANT_OWNED business tables:
--   USING / WITH CHECK require organization_id IS NOT NULL AND is_org_member(...)
--
-- Does NOT:
--   modify rows, columns, GRANTs, functions, or service_role behavior
--   add service_role bypass policies
--
-- service_role continues to bypass RLS for trusted Next.js server paths.

-- ---------------------------------------------------------------------------
-- 1) Legitimate global catalogs — split SELECT policies
-- ---------------------------------------------------------------------------

-- roles: system templates (organization_id IS NULL) + optional tenant roles
drop policy if exists roles_read on public.roles;
create policy roles_select_global on public.roles
  for select to authenticated
  using (organization_id is null);
create policy roles_select_tenant on public.roles
  for select to authenticated
  using (
    organization_id is not null
    and public.is_org_member(organization_id)
  );
-- No INSERT/UPDATE/DELETE policies on roles (tenant mutation remains impossible).

-- assessment_templates: SELECT-only global + tenant
drop policy if exists assessment_templates_read on public.assessment_templates;
create policy assessment_templates_select_global on public.assessment_templates
  for select to authenticated
  using (organization_id is null);
create policy assessment_templates_select_tenant on public.assessment_templates
  for select to authenticated
  using (
    organization_id is not null
    and public.is_org_member(organization_id)
  );

-- assessment_questions: SELECT via template; keep global-template visibility
drop policy if exists assessment_questions_member on public.assessment_questions;
create policy assessment_questions_select on public.assessment_questions
  for select to authenticated
  using (
    exists (
      select 1
      from public.assessment_templates t
      where t.id = assessment_questions.template_id
        and (
          t.organization_id is null
          or (
            t.organization_id is not null
            and public.is_org_member(t.organization_id)
          )
        )
    )
  );

-- campaign_templates: SELECT-only global + tenant
drop policy if exists campaign_templates_read on public.campaign_templates;
create policy campaign_templates_select_global on public.campaign_templates
  for select to authenticated
  using (organization_id is null);
create policy campaign_templates_select_tenant on public.campaign_templates
  for select to authenticated
  using (
    organization_id is not null
    and public.is_org_member(organization_id)
  );

-- ---------------------------------------------------------------------------
-- 2) Tenant-owned business tables — remove NULL-org bypass from ALL/SELECT
-- ---------------------------------------------------------------------------

-- Helper pattern for every table below:
--   using  (organization_id is not null and public.is_org_member(organization_id))
--   check  (organization_id is not null and public.is_org_member(organization_id))

drop policy if exists assessment_responses_all on public.assessment_responses;
create policy assessment_responses_tenant on public.assessment_responses
  for all
  using (
    organization_id is not null
    and public.is_org_member(organization_id)
  )
  with check (
    organization_id is not null
    and public.is_org_member(organization_id)
  );

-- audit_logs: SELECT-only; platform/null rows are not tenant-readable
drop policy if exists audit_select on public.audit_logs;
create policy audit_logs_tenant_select on public.audit_logs
  for select
  using (
    organization_id is not null
    and public.is_org_member(organization_id)
  );

drop policy if exists campaign_attribution_all on public.campaign_attribution;
create policy campaign_attribution_tenant on public.campaign_attribution
  for all
  using (
    organization_id is not null
    and public.is_org_member(organization_id)
  )
  with check (
    organization_id is not null
    and public.is_org_member(organization_id)
  );

drop policy if exists campaign_budgets_all on public.campaign_budgets;
create policy campaign_budgets_tenant on public.campaign_budgets
  for all
  using (
    organization_id is not null
    and public.is_org_member(organization_id)
  )
  with check (
    organization_id is not null
    and public.is_org_member(organization_id)
  );

drop policy if exists campaign_runs_all on public.campaign_channel_runs;
create policy campaign_channel_runs_tenant on public.campaign_channel_runs
  for all
  using (
    organization_id is not null
    and public.is_org_member(organization_id)
  )
  with check (
    organization_id is not null
    and public.is_org_member(organization_id)
  );

drop policy if exists campaign_channels_all on public.campaign_channels;
create policy campaign_channels_tenant on public.campaign_channels
  for all
  using (
    organization_id is not null
    and public.is_org_member(organization_id)
  )
  with check (
    organization_id is not null
    and public.is_org_member(organization_id)
  );

drop policy if exists campaign_creatives_all on public.campaign_creatives;
create policy campaign_creatives_tenant on public.campaign_creatives
  for all
  using (
    organization_id is not null
    and public.is_org_member(organization_id)
  )
  with check (
    organization_id is not null
    and public.is_org_member(organization_id)
  );

drop policy if exists campaign_landing_pages_all on public.campaign_landing_pages;
create policy campaign_landing_pages_tenant on public.campaign_landing_pages
  for all
  using (
    organization_id is not null
    and public.is_org_member(organization_id)
  )
  with check (
    organization_id is not null
    and public.is_org_member(organization_id)
  );

drop policy if exists campaign_metrics_all on public.campaign_metrics;
create policy campaign_metrics_tenant on public.campaign_metrics
  for all
  using (
    organization_id is not null
    and public.is_org_member(organization_id)
  )
  with check (
    organization_id is not null
    and public.is_org_member(organization_id)
  );

drop policy if exists campaign_territories_all on public.campaign_territories;
create policy campaign_territories_tenant on public.campaign_territories
  for all
  using (
    organization_id is not null
    and public.is_org_member(organization_id)
  )
  with check (
    organization_id is not null
    and public.is_org_member(organization_id)
  );

drop policy if exists crm_contact_attempts_all on public.crm_contact_attempts;
create policy crm_contact_attempts_tenant on public.crm_contact_attempts
  for all
  using (
    organization_id is not null
    and public.is_org_member(organization_id)
  )
  with check (
    organization_id is not null
    and public.is_org_member(organization_id)
  );

drop policy if exists crm_follow_ups_all on public.crm_follow_ups;
create policy crm_follow_ups_tenant on public.crm_follow_ups
  for all
  using (
    organization_id is not null
    and public.is_org_member(organization_id)
  )
  with check (
    organization_id is not null
    and public.is_org_member(organization_id)
  );

drop policy if exists crm_notes_all on public.crm_notes;
create policy crm_notes_tenant on public.crm_notes
  for all
  using (
    organization_id is not null
    and public.is_org_member(organization_id)
  )
  with check (
    organization_id is not null
    and public.is_org_member(organization_id)
  );

drop policy if exists integration_jobs_all on public.integration_jobs;
create policy integration_jobs_tenant on public.integration_jobs
  for all
  using (
    organization_id is not null
    and public.is_org_member(organization_id)
  )
  with check (
    organization_id is not null
    and public.is_org_member(organization_id)
  );

drop policy if exists intent_surges_all on public.intent_surges;
create policy intent_surges_tenant on public.intent_surges
  for all
  using (
    organization_id is not null
    and public.is_org_member(organization_id)
  )
  with check (
    organization_id is not null
    and public.is_org_member(organization_id)
  );

drop policy if exists lead_compliance_profiles_all on public.lead_compliance_profiles;
create policy lead_compliance_profiles_tenant on public.lead_compliance_profiles
  for all
  using (
    organization_id is not null
    and public.is_org_member(organization_id)
  )
  with check (
    organization_id is not null
    and public.is_org_member(organization_id)
  );

drop policy if exists lead_identity_matches_all on public.lead_identity_matches;
create policy lead_identity_matches_tenant on public.lead_identity_matches
  for all
  using (
    organization_id is not null
    and public.is_org_member(organization_id)
  )
  with check (
    organization_id is not null
    and public.is_org_member(organization_id)
  );

drop policy if exists lead_intelligence_profiles_all on public.lead_intelligence_profiles;
create policy lead_intelligence_profiles_tenant on public.lead_intelligence_profiles
  for all
  using (
    organization_id is not null
    and public.is_org_member(organization_id)
  )
  with check (
    organization_id is not null
    and public.is_org_member(organization_id)
  );

-- Pricing config: nullable org historically allowed platform defaults, but
-- tenant ALL+NULL WITH CHECK is unsafe. Tenants may only manage own rows;
-- any platform-default rows are service_role-only (RLS bypass).
drop policy if exists lead_pricing_config_all on public.lead_pricing_config;
create policy lead_pricing_config_tenant on public.lead_pricing_config
  for all
  using (
    organization_id is not null
    and public.is_org_member(organization_id)
  )
  with check (
    organization_id is not null
    and public.is_org_member(organization_id)
  );

drop policy if exists lead_qualification_factors_all on public.lead_qualification_factors;
create policy lead_qualification_factors_tenant on public.lead_qualification_factors
  for all
  using (
    organization_id is not null
    and public.is_org_member(organization_id)
  )
  with check (
    organization_id is not null
    and public.is_org_member(organization_id)
  );

drop policy if exists lead_qualification_profiles_all on public.lead_qualification_profiles;
create policy lead_qualification_profiles_tenant on public.lead_qualification_profiles
  for all
  using (
    organization_id is not null
    and public.is_org_member(organization_id)
  )
  with check (
    organization_id is not null
    and public.is_org_member(organization_id)
  );

drop policy if exists lead_qualification_snapshots_all on public.lead_qualification_snapshots;
create policy lead_qualification_snapshots_tenant on public.lead_qualification_snapshots
  for all
  using (
    organization_id is not null
    and public.is_org_member(organization_id)
  )
  with check (
    organization_id is not null
    and public.is_org_member(organization_id)
  );

drop policy if exists lead_score_snapshots_all on public.lead_score_snapshots;
create policy lead_score_snapshots_tenant on public.lead_score_snapshots
  for all
  using (
    organization_id is not null
    and public.is_org_member(organization_id)
  )
  with check (
    organization_id is not null
    and public.is_org_member(organization_id)
  );

drop policy if exists lead_sla_events_all on public.lead_sla_events;
create policy lead_sla_events_tenant on public.lead_sla_events
  for all
  using (
    organization_id is not null
    and public.is_org_member(organization_id)
  )
  with check (
    organization_id is not null
    and public.is_org_member(organization_id)
  );

drop policy if exists lead_stage_history_all on public.lead_stage_history;
create policy lead_stage_history_tenant on public.lead_stage_history
  for all
  using (
    organization_id is not null
    and public.is_org_member(organization_id)
  )
  with check (
    organization_id is not null
    and public.is_org_member(organization_id)
  );

drop policy if exists lead_validations_all on public.lead_validations;
create policy lead_validations_tenant on public.lead_validations
  for all
  using (
    organization_id is not null
    and public.is_org_member(organization_id)
  )
  with check (
    organization_id is not null
    and public.is_org_member(organization_id)
  );

drop policy if exists marketplace_listings_all on public.marketplace_listings;
create policy marketplace_listings_tenant on public.marketplace_listings
  for all
  using (
    organization_id is not null
    and public.is_org_member(organization_id)
  )
  with check (
    organization_id is not null
    and public.is_org_member(organization_id)
  );

drop policy if exists optimization_recommendations_all on public.optimization_recommendations;
create policy optimization_recommendations_tenant on public.optimization_recommendations
  for all
  using (
    organization_id is not null
    and public.is_org_member(organization_id)
  )
  with check (
    organization_id is not null
    and public.is_org_member(organization_id)
  );

-- Webhook events: unassigned/null org rows are platform/service_role only
drop policy if exists provider_webhook_events_all on public.provider_webhook_events;
create policy provider_webhook_events_tenant on public.provider_webhook_events
  for all
  using (
    organization_id is not null
    and public.is_org_member(organization_id)
  )
  with check (
    organization_id is not null
    and public.is_org_member(organization_id)
  );

drop policy if exists setter_verifications_all on public.setter_verifications;
create policy setter_verifications_tenant on public.setter_verifications
  for all
  using (
    organization_id is not null
    and public.is_org_member(organization_id)
  )
  with check (
    organization_id is not null
    and public.is_org_member(organization_id)
  );

-- ---------------------------------------------------------------------------
-- 3) lead_distributions — unassigned (NULL selected org) is platform-only
-- ---------------------------------------------------------------------------
-- NULL selected_organization_id is a marketplace assignment state handled by
-- trusted service_role paths. Authenticated tenants must not enumerate all
-- unassigned distributions.

drop policy if exists lead_distributions_select on public.lead_distributions;
create policy lead_distributions_tenant_select on public.lead_distributions
  for select
  using (
    selected_organization_id is not null
    and public.is_org_member(selected_organization_id)
  );
