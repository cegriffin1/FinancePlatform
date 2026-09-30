-- ALTUS Campaign Launch Slice A — media_assets + private campaign-media bucket
-- After: 20260929100000_supabase_admin_default_privilege_hardening.sql
--
-- IMPORTANT MIGRATION PATH NOTE:
--   20260929100000 is currently LOCAL-ONLY / unapplied on remote (CLI apply fails
--   with 42501 for ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin).
--   Do NOT push/apply this migration until the 100000 apply path is resolved
--   without repair/squash/history edits. Any normal db push would attempt
--   100000 first.
--
-- Scope:
--   public.media_assets (tenant metadata)
--   storage.buckets campaign-media (private)
--   RLS / grants for hybrid access model (service_role server paths)
--
-- Does NOT:
--   attach media to campaigns (Slice C)
--   implement Media Library UI (Slice B)
--   modify 100000
--   weaken existing RLS/grants
--
-- Future hardening: production-scale malware scanning for uploads.

-- ---------------------------------------------------------------------------
-- 1) media_assets table
-- ---------------------------------------------------------------------------
create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  original_filename text not null,
  storage_key text not null,
  mime_type text not null,
  media_type text not null
    check (media_type in ('IMAGE', 'VIDEO', 'DOCUMENT')),
  size_bytes bigint not null check (size_bytes > 0),
  width integer null check (width is null or width > 0),
  height integer null check (height is null or height > 0),
  duration_seconds numeric null check (duration_seconds is null or duration_seconds >= 0),
  checksum_sha256 text not null,
  status text not null default 'ACTIVE'
    check (status in ('ACTIVE', 'ARCHIVED')),
  created_by uuid null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint media_assets_storage_key_unique unique (storage_key),
  constraint media_assets_checksum_format check (checksum_sha256 ~ '^[a-f0-9]{64}$')
);

create index if not exists media_assets_org_created_idx
  on public.media_assets (organization_id, created_at desc);

create index if not exists media_assets_org_status_idx
  on public.media_assets (organization_id, status);

create index if not exists media_assets_org_checksum_idx
  on public.media_assets (organization_id, checksum_sha256);

comment on table public.media_assets is
  'Tenant-owned campaign media metadata. Binary originals live in private Storage bucket campaign-media.';

-- ---------------------------------------------------------------------------
-- 2) RLS — hardened tenant pattern (no NULL org bypass)
-- ---------------------------------------------------------------------------
alter table public.media_assets enable row level security;
alter table public.media_assets force row level security;

drop policy if exists media_assets_tenant on public.media_assets;
create policy media_assets_tenant on public.media_assets
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
-- 3) Grants — hybrid model (match 080000 intent)
--    anon: none
--    authenticated: no table DML (membership tables remain the JWT path)
--    service_role: server DML for Next.js media APIs after requireOrgAuth
-- ---------------------------------------------------------------------------
revoke all on table public.media_assets from anon, authenticated;
grant select, insert, update, delete on table public.media_assets to service_role;
revoke truncate, references, trigger on table public.media_assets from service_role;

-- ---------------------------------------------------------------------------
-- 4) Private storage bucket
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'campaign-media',
  'campaign-media',
  false,
  104857600, -- 100 MiB bucket ceiling; app enforces tighter per-type limits
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/mp4',
    'application/pdf'
  ]::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Storage object access: deny anon/authenticated by default (no permissive policies).
-- Trusted Next.js server uses service_role (bypasses storage RLS) AFTER requireOrgAuth
-- and org-scoped path {organization_id}/{asset_id}/{safe_filename}.
-- Short-lived signed URLs are issued by the server for previews.

drop policy if exists campaign_media_anon_all on storage.objects;
drop policy if exists campaign_media_authenticated_all on storage.objects;
