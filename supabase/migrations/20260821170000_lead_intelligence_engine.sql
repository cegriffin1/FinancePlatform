-- Lead intelligence engine extensions (additive)

create table if not exists public.lead_intelligence_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  fit_score integer not null default 0,
  intent_score integer not null default 0,
  engagement_score integer not null default 0,
  data_quality_score integer not null default 0,
  contactability_score integer not null default 0,
  conversion_score integer not null default 0,
  lead_value_score integer not null default 0,
  overall_priority_score integer not null default 0,
  lead_temperature text,
  quality_grade text,
  confidence numeric,
  estimated_value_band text,
  recommended_action text,
  quality_gate text,
  fraud_risk text,
  identity_result text,
  score_version text not null,
  model_version text not null,
  explanation text,
  profile jsonb not null default '{}'::jsonb,
  scored_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.lead_score_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  profile jsonb not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.lead_identity_matches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  matched_lead_id uuid references public.leads(id) on delete set null,
  result text not null,
  confidence numeric not null default 0,
  reasons jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.lead_validations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  field text not null,
  validation_status text not null,
  provider text not null,
  reason_code text,
  validated_at timestamptz
);

create table if not exists public.lead_sla_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  timers jsonb not null default '{}'::jsonb,
  sla_status text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.lead_stage_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  stage text not null,
  changed_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.lead_outcomes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  outcome text not null,
  reason_code text,
  closed_value_cents bigint,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.optimization_recommendations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete cascade,
  message text not null,
  severity text not null default 'info',
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.intent_surges (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  reasons jsonb not null default '[]'::jsonb,
  detected_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.subscriber_lead_feedback (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  feedback text not null,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.lead_intelligence_profiles enable row level security;
alter table public.lead_score_snapshots enable row level security;
alter table public.lead_identity_matches enable row level security;
alter table public.lead_validations enable row level security;
alter table public.lead_sla_events enable row level security;
alter table public.lead_stage_history enable row level security;
alter table public.lead_outcomes enable row level security;
alter table public.optimization_recommendations enable row level security;
alter table public.intent_surges enable row level security;
alter table public.subscriber_lead_feedback enable row level security;

create policy lead_intelligence_profiles_all on public.lead_intelligence_profiles
  for all using (organization_id is null or public.is_org_member(organization_id))
  with check (organization_id is null or public.is_org_member(organization_id));

create policy lead_score_snapshots_all on public.lead_score_snapshots
  for all using (organization_id is null or public.is_org_member(organization_id))
  with check (organization_id is null or public.is_org_member(organization_id));

create policy lead_identity_matches_all on public.lead_identity_matches
  for all using (organization_id is null or public.is_org_member(organization_id))
  with check (organization_id is null or public.is_org_member(organization_id));

create policy lead_validations_all on public.lead_validations
  for all using (organization_id is null or public.is_org_member(organization_id))
  with check (organization_id is null or public.is_org_member(organization_id));

create policy lead_sla_events_all on public.lead_sla_events
  for all using (organization_id is null or public.is_org_member(organization_id))
  with check (organization_id is null or public.is_org_member(organization_id));

create policy lead_stage_history_all on public.lead_stage_history
  for all using (organization_id is null or public.is_org_member(organization_id))
  with check (organization_id is null or public.is_org_member(organization_id));

create policy lead_outcomes_all on public.lead_outcomes
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy optimization_recommendations_all on public.optimization_recommendations
  for all using (organization_id is null or public.is_org_member(organization_id))
  with check (organization_id is null or public.is_org_member(organization_id));

create policy intent_surges_all on public.intent_surges
  for all using (organization_id is null or public.is_org_member(organization_id))
  with check (organization_id is null or public.is_org_member(organization_id));

create policy subscriber_lead_feedback_all on public.subscriber_lead_feedback
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
