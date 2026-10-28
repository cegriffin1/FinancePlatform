-- PREPARED FOR SEPARATE APPROVAL — DO NOT APPLY WITHOUT EXPLICIT APPROVAL.
-- Preferred appointment requests for Highwater Capital consumer journey.
-- Status `requested` = consumer preferred time only (NOT a confirmed booking).
--
-- DEPLOYMENT NOTE (2026-10 hardening):
-- Application deploy of appointment-request concurrency protection is
-- BLOCKED until this unique index is approved and applied in production.
-- Production lead_appointments row count was 0 at review time (safe to add).
--
-- Index scope: ONLY status = 'requested'
-- - Allows new preference requests after prior rows are cancelled/completed.
-- - Does NOT block setter confirmed/scheduled appointments.
-- - Does NOT block a later preference after the open request is cancelled.

comment on table public.lead_appointments is
  'Lead appointment records. status=requested means consumer preferred time only (not confirmed).';

create unique index if not exists lead_appointments_one_open_request_uidx
  on public.lead_appointments (lead_id)
  where status = 'requested';

-- Optional structured timezone (app currently also stamps time_zone= into notes).
alter table public.lead_appointments
  add column if not exists preferred_time_zone text;

alter table public.lead_appointments
  add column if not exists is_preference_only boolean not null default false;

comment on column public.lead_appointments.preferred_time_zone is
  'IANA time zone supplied with a preferred appointment request.';

comment on column public.lead_appointments.is_preference_only is
  'When true, scheduled_at is a consumer preference — not a verified booking.';
