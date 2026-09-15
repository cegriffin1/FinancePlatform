-- Setter verification, appointments, agent introductions (additive)

create table if not exists public.setter_verifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  asset_verification_status text not null default 'SELF_REPORTED',
  disposition text,
  disposition_reason text,
  call_attempted_at timestamptz,
  opened_at timestamptz,
  verified_at timestamptz,
  setter_user_id uuid,
  notes text,
  fields jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (lead_id)
);

create table if not exists public.lead_appointments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  agent_id uuid,
  agent_name text not null,
  scheduled_at timestamptz not null,
  preferred_contact_method text not null,
  notes text,
  status text not null default 'scheduled',
  created_by uuid,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.agent_introduction_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid not null,
  agent_name text not null,
  title text not null,
  experience_summary text not null,
  specialties jsonb not null default '[]'::jsonb,
  states_licenses jsonb not null default '[]'::jsonb,
  organization_name text not null,
  approved_introduction_script text not null,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.outbound_notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  channel text not null,
  kind text not null,
  title text not null,
  body text not null,
  recipient_agent_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  delivered boolean not null default false,
  deferred boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

-- Setter permissions (no automatic platform-admin)
insert into public.permissions (key, description)
select * from (values
  ('setter.leads.view', 'View setter queue and lead briefs'),
  ('setter.leads.verify', 'Verify lead fields and set dispositions'),
  ('setter.appointments.manage', 'Schedule appointments and hand off to agents')
) as v(key, description)
where exists (
  select 1 from information_schema.tables
  where table_schema = 'public' and table_name = 'permissions'
)
on conflict (key) do nothing;

alter table public.setter_verifications enable row level security;
alter table public.lead_appointments enable row level security;
alter table public.agent_introduction_profiles enable row level security;
alter table public.outbound_notifications enable row level security;

create policy setter_verifications_all on public.setter_verifications
  for all using (organization_id is null or public.is_org_member(organization_id))
  with check (organization_id is null or public.is_org_member(organization_id));

create policy lead_appointments_all on public.lead_appointments
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy agent_introduction_profiles_all on public.agent_introduction_profiles
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy outbound_notifications_all on public.outbound_notifications
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create index if not exists lead_appointments_lead_idx on public.lead_appointments (lead_id, scheduled_at desc);
create index if not exists setter_verifications_lead_idx on public.setter_verifications (lead_id);
create index if not exists outbound_notifications_org_idx on public.outbound_notifications (organization_id, created_at desc);
