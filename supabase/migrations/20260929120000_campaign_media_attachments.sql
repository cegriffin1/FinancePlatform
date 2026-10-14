-- ALTUS Campaign Launch Slice C — campaign ↔ media attachments
-- After: 20260929110000_campaign_media_assets.sql
--
-- Scope:
--   public.campaign_media_attachments (tenant join)
--   DB-enforced org equality across campaign + media_asset + row
--   RLS / least-privilege grants (hybrid model)
--
-- Does NOT:
--   OAuth / live publishing / Launch Center
--   restore former 100000 privilege hardening
--   weaken existing media_assets security

-- ---------------------------------------------------------------------------
-- 1) Attachment table
-- ---------------------------------------------------------------------------
create table if not exists public.campaign_media_attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  media_asset_id uuid not null references public.media_assets(id) on delete restrict,
  destination text null
    check (
      destination is null
      or destination in ('FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'TIKTOK')
    ),
  role text not null default 'PRIMARY'
    check (role in ('PRIMARY', 'SECONDARY', 'VARIANT')),
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.campaign_media_attachments is
  'Tenant campaign creative attachments to media_assets. destination NULL = campaign-shared pool.';

-- NULL-safe uniqueness (Postgres UNIQUE treats NULLs as distinct)
create unique index if not exists campaign_media_attachments_unique_idx
  on public.campaign_media_attachments (
    campaign_id,
    media_asset_id,
    role,
    (coalesce(destination, ''))
  );

create index if not exists campaign_media_attachments_org_campaign_idx
  on public.campaign_media_attachments (organization_id, campaign_id, sort_order);

create index if not exists campaign_media_attachments_media_idx
  on public.campaign_media_attachments (media_asset_id);

-- ---------------------------------------------------------------------------
-- 2) DB-enforced tenant equality (campaign / media / row)
-- ---------------------------------------------------------------------------
create or replace function public.enforce_campaign_media_attachment_org()
returns trigger
language plpgsql
as $$
declare
  campaign_org uuid;
  media_org uuid;
begin
  if new.organization_id is null then
    raise exception 'organization_id is required'
      using errcode = '23514';
  end if;

  select c.organization_id into campaign_org
  from public.campaigns c
  where c.id = new.campaign_id;

  if campaign_org is null then
    raise exception 'campaign missing or has null organization_id'
      using errcode = '23514';
  end if;

  if campaign_org is distinct from new.organization_id then
    raise exception 'campaign organization_id mismatch'
      using errcode = '23514';
  end if;

  select m.organization_id into media_org
  from public.media_assets m
  where m.id = new.media_asset_id;

  if media_org is null then
    raise exception 'media_asset missing'
      using errcode = '23514';
  end if;

  if media_org is distinct from new.organization_id then
    raise exception 'media_asset organization_id mismatch'
      using errcode = '23514';
  end if;

  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists campaign_media_attachments_org_enforce
  on public.campaign_media_attachments;
create trigger campaign_media_attachments_org_enforce
  before insert or update on public.campaign_media_attachments
  for each row
  execute function public.enforce_campaign_media_attachment_org();

-- ---------------------------------------------------------------------------
-- 3) RLS — hardened tenant pattern (no NULL org bypass)
-- ---------------------------------------------------------------------------
alter table public.campaign_media_attachments enable row level security;
alter table public.campaign_media_attachments force row level security;

drop policy if exists campaign_media_attachments_tenant
  on public.campaign_media_attachments;
create policy campaign_media_attachments_tenant
  on public.campaign_media_attachments
  for all
  to authenticated
  using (
    organization_id is not null
    and public.is_org_member(organization_id)
  )
  with check (
    organization_id is not null
    and public.is_org_member(organization_id)
  );

-- ---------------------------------------------------------------------------
-- 4) Grants — hybrid model (match media_assets)
-- ---------------------------------------------------------------------------
revoke all on table public.campaign_media_attachments from anon, authenticated;
grant select, insert, update, delete on table public.campaign_media_attachments
  to service_role;
revoke truncate, references, trigger
  on table public.campaign_media_attachments from service_role;
