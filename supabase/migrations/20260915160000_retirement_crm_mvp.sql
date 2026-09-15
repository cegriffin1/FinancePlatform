-- ALTUS retirement CRM MVP (ownership, follow-ups, notes) — additive

alter table public.leads
  add column if not exists owner_member_id uuid,
  add column if not exists ownership_started_at timestamptz,
  add column if not exists ownership_expires_at timestamptz,
  add column if not exists ownership_period_days integer,
  add column if not exists ownership_source text,
  add column if not exists crm_pipeline_stage text;

create table if not exists public.organization_crm_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  ownership_period_days integer not null default 60,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.crm_follow_ups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  due_at timestamptz,
  status text not null default 'open',
  created_by uuid,
  created_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz
);

create table if not exists public.crm_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  body text not null,
  created_by uuid,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.crm_contact_attempts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  channel text not null,
  result text,
  created_by uuid,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.organization_crm_settings enable row level security;
alter table public.crm_follow_ups enable row level security;
alter table public.crm_notes enable row level security;
alter table public.crm_contact_attempts enable row level security;

create policy organization_crm_settings_all on public.organization_crm_settings
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy crm_follow_ups_all on public.crm_follow_ups
  for all using (organization_id is null or public.is_org_member(organization_id))
  with check (organization_id is null or public.is_org_member(organization_id));

create policy crm_notes_all on public.crm_notes
  for all using (organization_id is null or public.is_org_member(organization_id))
  with check (organization_id is null or public.is_org_member(organization_id));

create policy crm_contact_attempts_all on public.crm_contact_attempts
  for all using (organization_id is null or public.is_org_member(organization_id))
  with check (organization_id is null or public.is_org_member(organization_id));
