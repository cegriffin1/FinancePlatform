-- Lead inventory, marketplace, compliance, reservations (additive)

alter table public.leads
  add column if not exists inventory_status text,
  add column if not exists marketplace_listed boolean default false,
  add column if not exists marketplace_price_cents bigint,
  add column if not exists lead_version integer default 1,
  add column if not exists original_score integer,
  add column if not exists current_score integer,
  add column if not exists original_temperature text,
  add column if not exists current_temperature text,
  add column if not exists compliance jsonb default '{}'::jsonb;

create table if not exists public.lead_compliance_profiles (
  lead_id uuid primary key references public.leads(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  marketing_consent boolean not null default false,
  contact_consent boolean not null default false,
  data_sharing_permitted boolean not null default false,
  resale_permitted boolean not null default false,
  suppressed boolean not null default false,
  suppression_reason text,
  retention_policy_days integer not null default 365,
  jurisdiction text,
  restricted_jurisdictions jsonb not null default '[]'::jsonb,
  consent_basis text,
  consent_captured_at timestamptz,
  sharing_permissions_note text,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  price_cents bigint not null,
  exclusivity text not null default 'exclusive',
  listed_at timestamptz not null default timezone('utc', now()),
  active boolean not null default true
);

create table if not exists public.lead_reservations (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  buyer_organization_id uuid not null references public.organizations(id) on delete cascade,
  buyer_agent_id uuid,
  reserved_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null,
  lead_version integer not null,
  status text not null default 'active'
);

create table if not exists public.lead_purchases (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  buyer_organization_id uuid not null references public.organizations(id) on delete cascade,
  buyer_agent_id uuid,
  seller_organization_id uuid references public.organizations(id) on delete set null,
  seller_type text not null,
  price_cents bigint not null,
  currency text not null default 'USD',
  purchased_at timestamptz not null default timezone('utc', now()),
  rights_granted jsonb not null default '[]'::jsonb,
  ownership_expires_at timestamptz not null,
  lead_version integer not null,
  consent_basis text not null,
  exclusivity text not null default 'exclusive',
  reservation_id uuid
);

create table if not exists public.lead_pricing_config (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  config jsonb not null,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.lead_compliance_profiles enable row level security;
alter table public.marketplace_listings enable row level security;
alter table public.lead_reservations enable row level security;
alter table public.lead_purchases enable row level security;
alter table public.lead_pricing_config enable row level security;

create policy lead_compliance_profiles_all on public.lead_compliance_profiles
  for all using (organization_id is null or public.is_org_member(organization_id))
  with check (organization_id is null or public.is_org_member(organization_id));

create policy marketplace_listings_all on public.marketplace_listings
  for all using (organization_id is null or public.is_org_member(organization_id))
  with check (organization_id is null or public.is_org_member(organization_id));

create policy lead_reservations_buyer on public.lead_reservations
  for all using (public.is_org_member(buyer_organization_id))
  with check (public.is_org_member(buyer_organization_id));

create policy lead_purchases_parties on public.lead_purchases
  for all using (
    public.is_org_member(buyer_organization_id)
    or (seller_organization_id is not null and public.is_org_member(seller_organization_id))
  )
  with check (public.is_org_member(buyer_organization_id));

create policy lead_pricing_config_all on public.lead_pricing_config
  for all using (organization_id is null or public.is_org_member(organization_id))
  with check (organization_id is null or public.is_org_member(organization_id));

create unique index if not exists lead_reservations_one_active
  on public.lead_reservations (lead_id)
  where status = 'active';
