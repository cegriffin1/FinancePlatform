-- Vertical slice additions: notifications + assessment templates
-- Additive only; does not duplicate existing growth-engine tables.

create table if not exists public.assessment_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  key text not null,
  version text not null,
  title text not null,
  estimated_minutes integer not null default 2,
  status text not null default 'published',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, key, version)
);

create table if not exists public.assessment_questions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.assessment_templates(id) on delete cascade,
  key text not null,
  prompt text not null,
  options jsonb not null default '[]'::jsonb,
  position integer not null default 0
);

create table if not exists public.assessment_responses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  template_key text not null,
  template_version text not null,
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.campaign_landing_pages (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  headline text,
  supporting_copy text,
  cta_label text,
  thank_you_message text,
  assessment_template_key text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (campaign_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.assessment_templates enable row level security;
alter table public.assessment_questions enable row level security;
alter table public.assessment_responses enable row level security;
alter table public.campaign_landing_pages enable row level security;
alter table public.notifications enable row level security;

create policy assessment_templates_read on public.assessment_templates
  for select to authenticated
  using (organization_id is null or public.is_org_member(organization_id));

create policy assessment_responses_all on public.assessment_responses
  for all using (organization_id is null or public.is_org_member(organization_id))
  with check (organization_id is null or public.is_org_member(organization_id));

create policy campaign_landing_pages_all on public.campaign_landing_pages
  for all using (organization_id is null or public.is_org_member(organization_id))
  with check (organization_id is null or public.is_org_member(organization_id));

create policy notifications_all on public.notifications
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
