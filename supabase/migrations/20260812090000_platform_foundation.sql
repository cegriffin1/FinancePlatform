-- Growth OS platform foundation
-- Multi-tenant schema + RLS baseline + permission seeds

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.current_profile_id()
returns uuid
language sql
stable
as $$
  select auth.uid();
$$;

create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = target_org
      and m.profile_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function public.has_org_permission(target_org uuid, permission_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members m
    join public.member_roles mr on mr.member_id = m.id
    join public.role_permissions rp on rp.role_id = mr.role_id
    join public.permissions p on p.id = rp.permission_id
    where m.organization_id = target_org
      and m.profile_id = auth.uid()
      and m.status = 'active'
      and p.key = permission_key
  );
$$;

-- ---------------------------------------------------------------------------
-- Core identity & tenancy
-- ---------------------------------------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active' check (status in ('active', 'inactive', 'suspended')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by uuid,
  updated_by uuid
);

create table public.organization_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  display_name text,
  logo_url text,
  primary_color text,
  timezone text not null default 'UTC',
  locale text not null default 'en-US',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by uuid,
  updated_by uuid
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  avatar_url text,
  is_platform_admin boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  code text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by uuid,
  updated_by uuid
);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  code text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by uuid,
  updated_by uuid
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  department_id uuid references public.departments(id) on delete set null,
  location_id uuid references public.locations(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by uuid,
  updated_by uuid
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'invited', 'inactive')),
  title text,
  location_id uuid references public.locations(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  team_id uuid references public.teams(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by uuid,
  updated_by uuid,
  unique (organization_id, profile_id)
);

create table public.reporting_relationships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  manager_member_id uuid not null references public.organization_members(id) on delete cascade,
  report_member_id uuid not null references public.organization_members(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by uuid,
  updated_by uuid,
  unique (organization_id, manager_member_id, report_member_id),
  check (manager_member_id <> report_member_id)
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  description text
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  key text not null,
  name text not null,
  is_system boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by uuid,
  updated_by uuid,
  unique (organization_id, key)
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table public.member_roles (
  member_id uuid not null references public.organization_members(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid,
  primary key (member_id, role_id)
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role_keys text[] not null default '{}',
  token_hash text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz not null,
  invited_by uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by uuid,
  updated_by uuid
);

-- ---------------------------------------------------------------------------
-- Growth objects
-- ---------------------------------------------------------------------------

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'paused', 'archived')),
  description text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by uuid,
  updated_by uuid
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text,
  full_name text,
  phone text,
  company_name text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by uuid,
  updated_by uuid
);

create table public.pipelines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by uuid,
  updated_by uuid
);

create table public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  pipeline_id uuid not null references public.pipelines(id) on delete cascade,
  name text not null,
  position integer not null default 0,
  probability numeric(5,2),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by uuid,
  updated_by uuid
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  assigned_to uuid references public.organization_members(id) on delete set null,
  team_id uuid references public.teams(id) on delete set null,
  status text not null default 'new' check (status in ('new', 'qualified', 'working', 'converted', 'disqualified')),
  score integer,
  source text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by uuid,
  updated_by uuid
);

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  pipeline_id uuid not null references public.pipelines(id) on delete restrict,
  stage_id uuid not null references public.pipeline_stages(id) on delete restrict,
  name text not null,
  amount numeric(14,2),
  assigned_to uuid references public.organization_members(id) on delete set null,
  status text not null default 'open' check (status in ('open', 'won', 'lost')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by uuid,
  updated_by uuid
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  opportunity_id uuid references public.opportunities(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  type text not null check (type in ('note', 'call', 'email', 'system')),
  body text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by uuid,
  updated_by uuid
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'open' check (status in ('open', 'done', 'cancelled')),
  due_at timestamptz,
  assigned_to uuid references public.organization_members(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  opportunity_id uuid references public.opportunities(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by uuid,
  updated_by uuid
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  assigned_to uuid references public.organization_members(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by uuid,
  updated_by uuid,
  check (ends_at > starts_at)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  actor_profile_id uuid,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null,
  status text not null default 'disconnected' check (status in ('disconnected', 'connected', 'error')),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by uuid,
  updated_by uuid,
  unique (organization_id, provider)
);

create table public.external_record_mappings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid not null references public.integration_connections(id) on delete cascade,
  entity_type text not null,
  local_id uuid not null,
  external_id text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by uuid,
  updated_by uuid,
  unique (connection_id, entity_type, local_id),
  unique (connection_id, entity_type, external_id)
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index idx_members_org on public.organization_members(organization_id);
create index idx_members_profile on public.organization_members(profile_id);
create index idx_teams_org on public.teams(organization_id);
create index idx_campaigns_org on public.campaigns(organization_id);
create index idx_leads_org on public.leads(organization_id);
create index idx_leads_assigned on public.leads(organization_id, assigned_to);
create index idx_opportunities_org on public.opportunities(organization_id);
create index idx_tasks_org on public.tasks(organization_id);
create index idx_activities_lead on public.activities(organization_id, lead_id);
create index idx_audit_org on public.audit_logs(organization_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'organizations','organization_settings','profiles','locations','departments','teams',
    'organization_members','reporting_relationships','roles','invitations','campaigns',
    'contacts','pipelines','pipeline_stages','leads','opportunities','activities','tasks',
    'appointments','integration_connections','external_record_mappings'
  ]
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at();',
      t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Permission seeds (global)
-- ---------------------------------------------------------------------------

insert into public.permissions (key, description) values
  ('organization.view', 'View organization'),
  ('organization.update', 'Update organization'),
  ('users.view', 'View users'),
  ('users.invite', 'Invite users'),
  ('users.update', 'Update users'),
  ('users.remove', 'Remove users'),
  ('teams.view', 'View teams'),
  ('teams.manage', 'Manage teams'),
  ('campaigns.view', 'View campaigns'),
  ('campaigns.create', 'Create campaigns'),
  ('campaigns.update', 'Update campaigns'),
  ('campaigns.publish', 'Publish campaigns'),
  ('leads.view_own', 'View own leads'),
  ('leads.view_team', 'View team leads'),
  ('leads.view_all', 'View all leads'),
  ('leads.assign', 'Assign leads'),
  ('leads.update', 'Update leads'),
  ('pipeline.view', 'View pipeline'),
  ('pipeline.manage', 'Manage pipeline'),
  ('reports.view_own', 'View own reports'),
  ('reports.view_team', 'View team reports'),
  ('reports.view_all', 'View all reports');

-- System role templates (organization_id null = global templates)
insert into public.roles (id, organization_id, key, name, is_system) values
  ('11111111-1111-4111-8111-111111111101', null, 'owner', 'Owner', true),
  ('11111111-1111-4111-8111-111111111102', null, 'admin', 'Administrator', true),
  ('11111111-1111-4111-8111-111111111103', null, 'manager', 'Manager', true),
  ('11111111-1111-4111-8111-111111111104', null, 'marketing', 'Marketing', true),
  ('11111111-1111-4111-8111-111111111105', null, 'sales', 'Sales', true),
  ('11111111-1111-4111-8111-111111111106', null, 'employee', 'Employee', true),
  ('11111111-1111-4111-8111-111111111107', null, 'contractor', 'Contractor', true);

-- Owner gets all permissions
insert into public.role_permissions (role_id, permission_id)
select '11111111-1111-4111-8111-111111111101', p.id from public.permissions p;

-- Admin gets all permissions (ownership transfer can be constrained in app later)
insert into public.role_permissions (role_id, permission_id)
select '11111111-1111-4111-8111-111111111102', p.id from public.permissions p;

-- Manager
insert into public.role_permissions (role_id, permission_id)
select '11111111-1111-4111-8111-111111111103', p.id
from public.permissions p
where p.key in (
  'organization.view','users.view','teams.view','teams.manage','campaigns.view',
  'leads.view_team','leads.assign','leads.update','pipeline.view','reports.view_team'
);

-- Marketing
insert into public.role_permissions (role_id, permission_id)
select '11111111-1111-4111-8111-111111111104', p.id
from public.permissions p
where p.key in (
  'organization.view','campaigns.view','campaigns.create','campaigns.update','campaigns.publish',
  'leads.view_team','reports.view_team'
);

-- Sales
insert into public.role_permissions (role_id, permission_id)
select '11111111-1111-4111-8111-111111111105', p.id
from public.permissions p
where p.key in (
  'organization.view','leads.view_own','leads.update','pipeline.view','reports.view_own'
);

-- Employee
insert into public.role_permissions (role_id, permission_id)
select '11111111-1111-4111-8111-111111111106', p.id
from public.permissions p
where p.key in (
  'organization.view','leads.view_own','leads.update','pipeline.view','reports.view_own'
);

-- Contractor
insert into public.role_permissions (role_id, permission_id)
select '11111111-1111-4111-8111-111111111107', p.id
from public.permissions p
where p.key in (
  'organization.view','leads.view_own','leads.update','pipeline.view'
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.organization_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;
alter table public.locations enable row level security;
alter table public.departments enable row level security;
alter table public.teams enable row level security;
alter table public.reporting_relationships enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.member_roles enable row level security;
alter table public.invitations enable row level security;
alter table public.campaigns enable row level security;
alter table public.leads enable row level security;
alter table public.contacts enable row level security;
alter table public.opportunities enable row level security;
alter table public.activities enable row level security;
alter table public.tasks enable row level security;
alter table public.appointments enable row level security;
alter table public.pipelines enable row level security;
alter table public.pipeline_stages enable row level security;
alter table public.audit_logs enable row level security;
alter table public.integration_connections enable row level security;
alter table public.external_record_mappings enable row level security;

-- Profiles: users can read/update themselves
create policy profiles_select_self on public.profiles
  for select using (id = auth.uid() or is_platform_admin = true);
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid());

-- Permissions catalog is readable to authenticated users
create policy permissions_read on public.permissions
  for select to authenticated using (true);

-- Global system role templates readable
create policy roles_read on public.roles
  for select to authenticated
  using (organization_id is null or public.is_org_member(organization_id));

create policy role_permissions_read on public.role_permissions
  for select to authenticated using (true);

-- Organizations: members only
create policy organizations_select on public.organizations
  for select using (public.is_org_member(id));
create policy organizations_update on public.organizations
  for update using (public.has_org_permission(id, 'organization.update'));

create policy organization_settings_all on public.organization_settings
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy members_select on public.organization_members
  for select using (public.is_org_member(organization_id));
create policy members_modify on public.organization_members
  for all using (public.has_org_permission(organization_id, 'users.update'))
  with check (public.has_org_permission(organization_id, 'users.update'));

-- Generic org-scoped read/write helpers via membership
create policy locations_all on public.locations
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
create policy departments_all on public.departments
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
create policy teams_all on public.teams
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
create policy reporting_all on public.reporting_relationships
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
create policy member_roles_select on public.member_roles
  for select using (
    exists (
      select 1 from public.organization_members m
      where m.id = member_id and public.is_org_member(m.organization_id)
    )
  );
create policy invitations_all on public.invitations
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
create policy campaigns_all on public.campaigns
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
create policy leads_all on public.leads
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
create policy contacts_all on public.contacts
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
create policy opportunities_all on public.opportunities
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
create policy activities_all on public.activities
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
create policy tasks_all on public.tasks
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
create policy appointments_all on public.appointments
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
create policy pipelines_all on public.pipelines
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
create policy pipeline_stages_all on public.pipeline_stages
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
create policy audit_select on public.audit_logs
  for select using (organization_id is null or public.is_org_member(organization_id));
create policy integrations_all on public.integration_connections
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
create policy mappings_all on public.external_record_mappings
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
