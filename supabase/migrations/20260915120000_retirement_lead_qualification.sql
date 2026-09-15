-- Retirement MVP qualification: temperature, assets, commercial status (additive)

alter table public.leads
  add column if not exists profile_completion_percentage integer,
  add column if not exists opportunity_score integer,
  add column if not exists temperature_score integer,
  add column if not exists lead_temperature text,
  add column if not exists commercial_lead_status text,
  add column if not exists asset_commercial_tier text,
  add column if not exists asset_verification_status text,
  add column if not exists lead_grade text,
  add column if not exists agent_eligible boolean default false,
  add column if not exists setter_priority integer,
  add column if not exists temperature_version text,
  add column if not exists qualification_score_version text;

create table if not exists public.lead_qualification_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  profile_completion_percentage integer not null default 0,
  answered_core_questions integer not null default 0,
  applicable_questions integer not null default 0,
  opportunity_score integer not null default 0,
  temperature_score integer not null default 0,
  lead_temperature text not null,
  commercial_lead_status text not null,
  asset_commercial_tier text not null,
  asset_verification_status text not null default 'SELF_REPORTED',
  repositionable_min_cents bigint,
  repositionable_max_cents bigint,
  meets_target_asset_threshold boolean not null default false,
  intent_label text,
  lead_grade text,
  agent_eligible boolean not null default false,
  setter_priority integer not null default 0,
  recommended_next_step text,
  score_version text not null,
  temperature_version text not null,
  profile jsonb not null default '{}'::jsonb,
  scored_at timestamptz not null default timezone('utc', now())
);

-- Append-only scoring history — never overwrite prior runs
create table if not exists public.lead_qualification_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  score_version text not null,
  temperature_version text not null,
  profile jsonb not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.lead_qualification_factors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  snapshot_id uuid references public.lead_qualification_snapshots(id) on delete cascade,
  score_version text not null,
  temperature_version text,
  factor text not null,
  dimension text,
  points integer not null default 0,
  reason text not null,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.lead_qualification_profiles enable row level security;
alter table public.lead_qualification_snapshots enable row level security;
alter table public.lead_qualification_factors enable row level security;

create policy lead_qualification_profiles_all on public.lead_qualification_profiles
  for all using (organization_id is null or public.is_org_member(organization_id))
  with check (organization_id is null or public.is_org_member(organization_id));

create policy lead_qualification_snapshots_all on public.lead_qualification_snapshots
  for all using (organization_id is null or public.is_org_member(organization_id))
  with check (organization_id is null or public.is_org_member(organization_id));

create policy lead_qualification_factors_all on public.lead_qualification_factors
  for all using (organization_id is null or public.is_org_member(organization_id))
  with check (organization_id is null or public.is_org_member(organization_id));

create index if not exists lead_qualification_profiles_lead_idx
  on public.lead_qualification_profiles (lead_id);
create index if not exists lead_qualification_snapshots_lead_idx
  on public.lead_qualification_snapshots (lead_id, created_at desc);
create index if not exists lead_qualification_factors_lead_idx
  on public.lead_qualification_factors (lead_id, created_at desc);
