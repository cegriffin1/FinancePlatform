-- Growth engine Phase 1 — additive campaign / scoring / distribution schema
-- Preserves 20260812090000_platform_foundation.sql
-- Does not implement live ad publishing.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Extend campaigns for dual ownership model
-- ---------------------------------------------------------------------------

alter table public.campaigns
  alter column organization_id drop not null;

alter table public.campaigns
  add column if not exists owner_type text
    check (owner_type in ('ALTUS_PLATFORM_CAMPAIGN', 'SUBSCRIBER_CAMPAIGN')),
  add column if not exists owner_id uuid,
  add column if not exists goal text,
  add column if not exists strategy text,
  add column if not exists audience jsonb not null default '{}'::jsonb,
  add column if not exists territories text[] not null default '{}',
  add column if not exists channels text[] not null default '{}',
  add column if not exists destination text,
  add column if not exists budget_cents bigint,
  add column if not exists currency text not null default 'USD',
  add column if not exists template_id uuid,
  add column if not exists branding jsonb not null default '{}'::jsonb,
  add column if not exists qualification_template_key text,
  add column if not exists distribution_config jsonb not null default '{}'::jsonb,
  add column if not exists launched_at timestamptz,
  add column if not exists workflow_status text;

-- Soft-expand status vocabulary via workflow_status; keep legacy status for compat.
comment on column public.campaigns.owner_type is
  'ALTUS_PLATFORM_CAMPAIGN vs SUBSCRIBER_CAMPAIGN — separate from owner_id';

-- ---------------------------------------------------------------------------
-- Extend leads for attribution + score breakdown
-- ---------------------------------------------------------------------------

alter table public.leads
  add column if not exists platform_campaign_id uuid,
  add column if not exists fit_score integer,
  add column if not exists intent_score integer,
  add column if not exists engagement_score integer,
  add column if not exists temperature_key text,
  add column if not exists lifecycle_status text,
  add column if not exists score_version text,
  add column if not exists consent_captured boolean default false,
  add column if not exists territory text,
  add column if not exists qualification_session_id uuid;

-- ---------------------------------------------------------------------------
-- Campaign templates & catalog
-- ---------------------------------------------------------------------------

create table if not exists public.campaign_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  module_key text,
  key text not null,
  name text not null,
  strategy text not null,
  goal text not null,
  description text,
  default_destination text,
  default_channels text[] not null default '{}',
  qualification_template_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by uuid,
  updated_by uuid,
  unique (organization_id, key)
);

create table if not exists public.campaign_budgets (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  amount_cents bigint not null default 0,
  currency text not null default 'USD',
  spent_cents bigint not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by uuid,
  updated_by uuid
);

create table if not exists public.campaign_territories (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  region_code text not null,
  country_code text not null default 'US',
  created_at timestamptz not null default timezone('utc', now()),
  unique (campaign_id, region_code, country_code)
);

create table if not exists public.campaign_channels (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  provider text not null,
  status text not null default 'draft',
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.campaign_channel_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null,
  external_account_id text not null,
  external_business_id text,
  account_name text not null,
  connection_status text not null default 'disconnected'
    check (connection_status in ('disconnected', 'connected', 'error', 'pending')),
  scopes text[] not null default '{}',
  encrypted_credentials_reference text,
  last_sync_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by uuid,
  updated_by uuid,
  unique (organization_id, provider, external_account_id)
);

create table if not exists public.campaign_channel_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  provider text not null,
  connected_account_id uuid references public.campaign_channel_connections(id) on delete set null,
  external_campaign_id text,
  status text not null default 'draft',
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by uuid,
  updated_by uuid
);

create table if not exists public.campaign_creatives (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  channel text,
  asset_url text,
  copy jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.campaign_attribution (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  platform_campaign_id uuid references public.campaigns(id) on delete set null,
  owner_type text,
  ad_provider text,
  external_campaign_id text,
  ad_set_id text,
  creative_id text,
  source text,
  medium text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  landing_page text,
  territory text,
  captured_at timestamptz not null default timezone('utc', now()),
  unique (lead_id)
);

create table if not exists public.campaign_metrics (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  provider text,
  period_start date,
  period_end date,
  spend_cents bigint not null default 0,
  clicks integer not null default 0,
  impressions integer not null default 0,
  leads integer not null default 0,
  qualified_leads integer not null default 0,
  appointments integer not null default 0,
  conversions integer not null default 0,
  revenue_cents bigint not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

-- ---------------------------------------------------------------------------
-- Lead intelligence tables
-- ---------------------------------------------------------------------------

create table if not exists public.lead_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  event_type text not null,
  occurred_at timestamptz not null default timezone('utc', now()),
  actor_profile_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.lead_scores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  total_score integer not null,
  fit_score integer not null default 0,
  intent_score integer not null default 0,
  engagement_score integer not null default 0,
  classification text not null,
  scoring_version text not null,
  explanation text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.lead_score_factors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_score_id uuid not null references public.lead_scores(id) on delete cascade,
  key text not null,
  category text not null check (category in ('fit', 'intent', 'engagement')),
  points integer not null,
  reason text not null
);

create table if not exists public.lead_strategy_classifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  strategy_category text not null,
  strategy_confidence numeric(5,4) not null default 0,
  classification_reason text not null,
  classification_version text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.lead_distributions (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  selected_organization_id uuid references public.organizations(id) on delete set null,
  selected_agent_id uuid references public.organization_members(id) on delete set null,
  distribution_method text not null,
  rule_version text not null,
  decided_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.lead_distribution_candidates (
  id uuid primary key default gen_random_uuid(),
  distribution_id uuid not null references public.lead_distributions(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rejected boolean not null default false,
  rejection_reason text
);

create table if not exists public.lead_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  assigned_to uuid references public.organization_members(id) on delete set null,
  team_id uuid references public.teams(id) on delete set null,
  assigned_at timestamptz not null default timezone('utc', now()),
  first_viewed_at timestamptz,
  first_contact_at timestamptz,
  claim_locked_at timestamptz,
  sla_status text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by uuid,
  updated_by uuid
);

create table if not exists public.lead_sla_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  assignment_id uuid references public.lead_assignments(id) on delete set null,
  event_type text not null,
  expected_minutes integer,
  actual_minutes integer,
  status text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.lead_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  from_status text,
  to_status text not null,
  reason text,
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid
);

create table if not exists public.organization_territories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  region_code text not null,
  country_code text not null default 'US',
  status text not null default 'active',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by uuid,
  updated_by uuid,
  unique (organization_id, region_code, country_code)
);

create table if not exists public.agent_licenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  member_id uuid not null references public.organization_members(id) on delete cascade,
  license_type text not null,
  jurisdiction_code text not null,
  status text not null default 'declared',
  attestation_source text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by uuid,
  updated_by uuid
);

create table if not exists public.subscription_entitlements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tier text not null check (tier in ('STANDARD', 'PRO', 'PREMIER', 'ENTERPRISE')),
  entitlement_key text not null,
  entitlement_value jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, entitlement_key)
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists idx_campaigns_owner_type on public.campaigns(owner_type);
create index if not exists idx_lead_events_lead on public.lead_events(organization_id, lead_id, occurred_at desc);
create index if not exists idx_lead_scores_lead on public.lead_scores(organization_id, lead_id, created_at desc);
create index if not exists idx_lead_distributions_lead on public.lead_distributions(lead_id);
create index if not exists idx_campaign_attribution_campaign on public.campaign_attribution(campaign_id);
create index if not exists idx_org_territories_org on public.organization_territories(organization_id);

-- ---------------------------------------------------------------------------
-- RLS for new tables
-- ---------------------------------------------------------------------------

alter table public.campaign_templates enable row level security;
alter table public.campaign_budgets enable row level security;
alter table public.campaign_territories enable row level security;
alter table public.campaign_channels enable row level security;
alter table public.campaign_channel_connections enable row level security;
alter table public.campaign_channel_runs enable row level security;
alter table public.campaign_creatives enable row level security;
alter table public.campaign_attribution enable row level security;
alter table public.campaign_metrics enable row level security;
alter table public.lead_events enable row level security;
alter table public.lead_scores enable row level security;
alter table public.lead_score_factors enable row level security;
alter table public.lead_strategy_classifications enable row level security;
alter table public.lead_distributions enable row level security;
alter table public.lead_distribution_candidates enable row level security;
alter table public.lead_assignments enable row level security;
alter table public.lead_sla_events enable row level security;
alter table public.lead_lifecycle_events enable row level security;
alter table public.organization_territories enable row level security;
alter table public.agent_licenses enable row level security;
alter table public.subscription_entitlements enable row level security;

-- Platform templates readable by authenticated users
create policy campaign_templates_read on public.campaign_templates
  for select to authenticated
  using (organization_id is null or public.is_org_member(organization_id));

create policy campaign_budgets_all on public.campaign_budgets
  for all using (organization_id is null or public.is_org_member(organization_id))
  with check (organization_id is null or public.is_org_member(organization_id));

create policy campaign_territories_all on public.campaign_territories
  for all using (organization_id is null or public.is_org_member(organization_id))
  with check (organization_id is null or public.is_org_member(organization_id));

create policy campaign_channels_all on public.campaign_channels
  for all using (organization_id is null or public.is_org_member(organization_id))
  with check (organization_id is null or public.is_org_member(organization_id));

create policy campaign_connections_all on public.campaign_channel_connections
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy campaign_runs_all on public.campaign_channel_runs
  for all using (organization_id is null or public.is_org_member(organization_id))
  with check (organization_id is null or public.is_org_member(organization_id));

create policy campaign_creatives_all on public.campaign_creatives
  for all using (organization_id is null or public.is_org_member(organization_id))
  with check (organization_id is null or public.is_org_member(organization_id));

create policy campaign_attribution_all on public.campaign_attribution
  for all using (organization_id is null or public.is_org_member(organization_id))
  with check (organization_id is null or public.is_org_member(organization_id));

create policy campaign_metrics_all on public.campaign_metrics
  for all using (organization_id is null or public.is_org_member(organization_id))
  with check (organization_id is null or public.is_org_member(organization_id));

create policy lead_events_all on public.lead_events
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy lead_scores_all on public.lead_scores
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy lead_score_factors_all on public.lead_score_factors
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy lead_strategy_all on public.lead_strategy_classifications
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy lead_assignments_all on public.lead_assignments
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy lead_sla_all on public.lead_sla_events
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy lead_lifecycle_all on public.lead_lifecycle_events
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy org_territories_all on public.organization_territories
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy agent_licenses_all on public.agent_licenses
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy subscription_entitlements_all on public.subscription_entitlements
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

-- Distribution audit: readable by members of selected org; inserts via service role / trusted path
create policy lead_distributions_select on public.lead_distributions
  for select using (
    selected_organization_id is null
    or public.is_org_member(selected_organization_id)
  );

create policy lead_distribution_candidates_select on public.lead_distribution_candidates
  for select using (public.is_org_member(organization_id));
