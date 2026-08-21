-- Social channel integrations — additive schema extensions

alter table public.integration_connections
  add column if not exists mode text not null default 'SIMULATION',
  add column if not exists provider_account_id text,
  add column if not exists provider_business_id text,
  add column if not exists scopes text[] not null default '{}',
  add column if not exists connected_at timestamptz,
  add column if not exists last_refreshed_at timestamptz,
  add column if not exists last_synced_at timestamptz,
  add column if not exists token_expires_at timestamptz,
  add column if not exists credential_ref text,
  add column if not exists last_error text,
  add column if not exists permissions_summary text[] not null default '{}',
  add column if not exists display_account_name text;

-- Expand status vocabulary used by application layer
alter table public.integration_connections
  drop constraint if exists integration_connections_status_check;

alter table public.integration_connections
  add constraint integration_connections_status_check
  check (status in (
    'disconnected','connected','error',
    'NOT_CONNECTED','CONNECTING','CONNECTED','ACTION_REQUIRED','EXPIRED','ERROR'
  ));

alter table public.external_record_mappings
  add column if not exists provider text,
  add column if not exists internal_entity_type text,
  add column if not exists internal_entity_id uuid,
  add column if not exists external_entity_type text,
  add column if not exists external_entity_id text,
  add column if not exists account_id text,
  add column if not exists last_synced_at timestamptz;

create table if not exists public.provider_webhook_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  provider text not null,
  external_event_id text not null,
  event_type text not null,
  received_at timestamptz not null default timezone('utc', now()),
  processing_status text not null default 'received',
  payload_reference text not null,
  processed_at timestamptz,
  error text,
  unique (provider, external_event_id)
);

create table if not exists public.campaign_metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  provider text not null,
  snapshot_date date not null,
  impressions integer not null default 0,
  reach integer not null default 0,
  clicks integer not null default 0,
  spend_cents bigint not null default 0,
  leads integer not null default 0,
  qualified_leads integer not null default 0,
  appointments integer not null default 0,
  conversions integer not null default 0,
  revenue_cents bigint not null default 0,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, campaign_id, provider, snapshot_date)
);

create table if not exists public.creative_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  asset_type text not null,
  file_reference text,
  headline text not null,
  body text not null,
  cta text not null,
  destination_url text,
  status text not null default 'active',
  created_by uuid,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.integration_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  job_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued',
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  next_run_at timestamptz not null default timezone('utc', now()),
  last_error text,
  idempotency_key text,
  created_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz
);

create unique index if not exists idx_integration_jobs_idempotency
  on public.integration_jobs(idempotency_key)
  where idempotency_key is not null;

insert into public.permissions (key, description) values
  ('campaigns.pause', 'Pause campaigns'),
  ('campaigns.approve', 'Approve campaigns for publish'),
  ('campaigns.budget.view', 'View campaign budgets'),
  ('campaigns.budget.manage', 'Manage campaign budgets'),
  ('integrations.view', 'View marketing integrations'),
  ('integrations.manage', 'Manage marketing integrations')
on conflict (key) do nothing;

alter table public.provider_webhook_events enable row level security;
alter table public.campaign_metric_snapshots enable row level security;
alter table public.creative_assets enable row level security;
alter table public.integration_jobs enable row level security;

create policy provider_webhook_events_all on public.provider_webhook_events
  for all using (organization_id is null or public.is_org_member(organization_id))
  with check (organization_id is null or public.is_org_member(organization_id));

create policy campaign_metric_snapshots_all on public.campaign_metric_snapshots
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy creative_assets_all on public.creative_assets
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy integration_jobs_all on public.integration_jobs
  for all using (organization_id is null or public.is_org_member(organization_id))
  with check (organization_id is null or public.is_org_member(organization_id));
