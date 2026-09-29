-- Production Foundation Phase 1 — additive durable prospect path
-- assessment_sessions, session answers, campaign slug, lead session link
-- Does not drop or rename existing columns.

-- ---------------------------------------------------------------------------
-- Campaigns: public slug for /c/[org]/[slug]
-- ---------------------------------------------------------------------------
alter table public.campaigns
  add column if not exists slug text;

create unique index if not exists campaigns_org_slug_uidx
  on public.campaigns (organization_id, slug)
  where slug is not null and organization_id is not null;

create unique index if not exists campaigns_platform_slug_uidx
  on public.campaigns (slug)
  where slug is not null and organization_id is null;

-- ---------------------------------------------------------------------------
-- Assessment sessions (pre-lead progressive capture)
-- ---------------------------------------------------------------------------
create table if not exists public.assessment_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  organization_slug text,
  campaign_slug text,
  assessment_definition_id text not null,
  assessment_version text not null,
  status text not null default 'active'
    check (status in ('active', 'completed', 'abandoned')),
  current_stage text,
  last_completed_question text,
  last_completed_stage text,
  completion_percentage integer not null default 0,
  branch text,
  contactable boolean not null default false,
  resume_token text not null unique default encode(gen_random_bytes(32), 'hex'),
  attribution jsonb not null default '{}'::jsonb,
  answers jsonb not null default '{}'::jsonb,
  lead_id uuid references public.leads(id) on delete set null,
  source text,
  started_at timestamptz,
  contact_captured_at timestamptz,
  completed_at timestamptz,
  abandoned_at timestamptz,
  last_activity_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists assessment_sessions_org_idx
  on public.assessment_sessions (organization_id);
create index if not exists assessment_sessions_campaign_idx
  on public.assessment_sessions (campaign_id);
create index if not exists assessment_sessions_lead_idx
  on public.assessment_sessions (lead_id);
create index if not exists assessment_sessions_activity_idx
  on public.assessment_sessions (last_activity_at desc);

-- One primary lead per completed session (idempotency)
create unique index if not exists assessment_sessions_lead_uidx
  on public.assessment_sessions (lead_id)
  where lead_id is not null;

-- ---------------------------------------------------------------------------
-- Per-question answers (idempotent upsert by session + question)
-- ---------------------------------------------------------------------------
create table if not exists public.assessment_session_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.assessment_sessions(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  question_key text not null,
  value text not null,
  stage text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (session_id, question_key)
);

create index if not exists assessment_session_answers_session_idx
  on public.assessment_session_answers (session_id);

-- ---------------------------------------------------------------------------
-- Funnel events for pilot observability
-- ---------------------------------------------------------------------------
create table if not exists public.assessment_funnel_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.assessment_sessions(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists assessment_funnel_events_session_idx
  on public.assessment_funnel_events (session_id, created_at);

-- ---------------------------------------------------------------------------
-- Lead extensions for durable golden path
-- ---------------------------------------------------------------------------
alter table public.leads
  add column if not exists assessment_session_id uuid
    references public.assessment_sessions(id) on delete set null,
  add column if not exists operational_temperature text
    check (operational_temperature is null or operational_temperature in ('HOT', 'MEDIUM', 'COLD')),
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists preferred_contact text,
  add column if not exists opportunity_score integer,
  add column if not exists score_classification text,
  add column if not exists score_explanation text,
  add column if not exists attribution jsonb not null default '{}'::jsonb,
  add column if not exists assessment_answers jsonb not null default '{}'::jsonb,
  add column if not exists last_meaningful_interaction_at timestamptz,
  add column if not exists last_activity_at timestamptz,
  add column if not exists qualified_at timestamptz,
  add column if not exists assignment_reason text,
  add column if not exists assignment_method text;

create unique index if not exists leads_assessment_session_uidx
  on public.leads (assessment_session_id)
  where assessment_session_id is not null;

create index if not exists leads_org_temp_idx
  on public.leads (organization_id, operational_temperature);

create index if not exists leads_org_created_idx
  on public.leads (organization_id, created_at desc);

create index if not exists leads_email_org_idx
  on public.leads (organization_id, email)
  where email is not null;

-- Temperature history (smallest additive structure)
create table if not exists public.lead_temperature_snapshots (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  temperature text not null check (temperature in ('HOT', 'MEDIUM', 'COLD')),
  reason text,
  previous_temperature text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists lead_temperature_snapshots_lead_idx
  on public.lead_temperature_snapshots (lead_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS — organization membership only (no null-org OR bypass for owned rows)
-- Public writes go through service-role API routes only.
-- ---------------------------------------------------------------------------
alter table public.assessment_sessions enable row level security;
alter table public.assessment_session_answers enable row level security;
alter table public.assessment_funnel_events enable row level security;
alter table public.lead_temperature_snapshots enable row level security;

drop policy if exists assessment_sessions_member on public.assessment_sessions;
create policy assessment_sessions_member on public.assessment_sessions
  for all to authenticated
  using (organization_id is not null and public.is_org_member(organization_id))
  with check (organization_id is not null and public.is_org_member(organization_id));

drop policy if exists assessment_session_answers_member on public.assessment_session_answers;
create policy assessment_session_answers_member on public.assessment_session_answers
  for all to authenticated
  using (organization_id is not null and public.is_org_member(organization_id))
  with check (organization_id is not null and public.is_org_member(organization_id));

drop policy if exists assessment_funnel_events_member on public.assessment_funnel_events;
create policy assessment_funnel_events_member on public.assessment_funnel_events
  for all to authenticated
  using (organization_id is not null and public.is_org_member(organization_id))
  with check (organization_id is not null and public.is_org_member(organization_id));

drop policy if exists lead_temperature_snapshots_member on public.lead_temperature_snapshots;
create policy lead_temperature_snapshots_member on public.lead_temperature_snapshots
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

-- Tighten assessment_questions: allow template owners via join
drop policy if exists assessment_questions_member on public.assessment_questions;
create policy assessment_questions_member on public.assessment_questions
  for select to authenticated
  using (
    exists (
      select 1 from public.assessment_templates t
      where t.id = assessment_questions.template_id
        and (t.organization_id is null or public.is_org_member(t.organization_id))
    )
  );
