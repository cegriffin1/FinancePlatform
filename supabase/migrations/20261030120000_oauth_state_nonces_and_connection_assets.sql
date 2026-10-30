-- Durable OAuth state nonces + Connected Accounts metadata on integration_connections.
-- Applied to STAGING (xrxikvktrngmbiavhwlp) on 2026-10-30.
-- Do NOT apply to production without separate approval.
-- LIVE social OAuth / token exchange remain disabled in application code.

-- ---------------------------------------------------------------------------
-- OAuth state nonce ledger (single-use across serverless instances)
-- ---------------------------------------------------------------------------
create table if not exists public.oauth_state_nonces (
  nonce text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid,
  provider text not null,
  platform text not null,
  issued_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_oauth_state_nonces_expires
  on public.oauth_state_nonces (expires_at);

create index if not exists idx_oauth_state_nonces_org
  on public.oauth_state_nonces (organization_id);

alter table public.oauth_state_nonces enable row level security;

-- Service-role / backend only — no direct client access policies on purpose.
-- (RLS enabled with zero policies denies anon/authenticated by default.)

-- ---------------------------------------------------------------------------
-- Connected Accounts display metadata on existing integration_connections
-- ---------------------------------------------------------------------------
alter table public.integration_connections
  add column if not exists authorized_assets text[] not null default '{}',
  add column if not exists platform_hint text;

comment on table public.oauth_state_nonces is
  'Short-lived OAuth CSRF nonces. Insert on authorize; delete/mark consumed atomically on callback.';

comment on column public.integration_connections.credential_ref is
  'Opaque sealed token bundle reference — never return to browsers.';

comment on column public.integration_connections.authorized_assets is
  'Non-secret labels for Pages / IG / ad accounts shown in Connected Accounts UI.';
