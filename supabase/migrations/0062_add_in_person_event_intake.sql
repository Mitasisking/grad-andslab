-- ============================================================================
-- Migration: 0062_add_in_person_event_intake.sql
--
-- Adds "In-Person Event Drop-Off" intake for live card shows/conventions.
--
-- Deliberately does NOT touch public.submission_status (received/inspected/
-- shipped/graded/returned, 0001_init_schema.sql) or
-- lib/admin/submission-status.ts's changeSubmissionStatus, which only
-- accepts that fixed 5-value enum and drives the customer-facing pipeline
-- stepper (components/dashboard/pipeline-progress.tsx's STATUS_STAGES).
-- "Awaiting Booth Handover" / "Received & Logged" are modeled as DERIVED
-- states from the columns below (intake_channel = 'in_person_event' and
-- whether intake_verified_at is set), not as new enum values -- every
-- submission, in-person or not, still gets status = 'received' at creation
-- exactly like today (app/api/submissions/route.ts), so the existing
-- pipeline/status-log/admin-grading machinery needs zero changes.
--
-- All four new submissions columns are nullable/defaulted, so this adds
-- cleanly against existing rows with no backfill and no risk of failing
-- chk_submissions_event_fields_match_channel below (every existing row is
-- 'online_shipment' with both event_slug/handover_pin already null).
-- ============================================================================

alter table public.submissions
  add column intake_channel text not null default 'online_shipment',
  add column event_slug text,
  add column handover_pin varchar(4),
  add column intake_verified_at timestamptz;

alter table public.submissions
  add constraint chk_submissions_intake_channel_valid
  check (intake_channel in ('online_shipment', 'in_person_event'));

-- An online submission can never carry event/PIN fields; an in-person one
-- may (event_slug is optional even then -- an admin could run a live event
-- with no slug set, per app/admin/events below).
alter table public.submissions
  add constraint chk_submissions_event_fields_match_channel
  check (
    intake_channel = 'in_person_event'
    or (event_slug is null and handover_pin is null and intake_verified_at is null)
  );

-- Singleton settings row (id is always literally `true`, so at most one row
-- can ever exist) driving the /submit wizard's fallback in-person detection
-- when no ?intake=in-person&event=... URL param is present -- see
-- app/admin/events/page.tsx (admin toggle) and app/api/events/active/route.ts
-- (public read used by the wizard).
create table public.event_settings (
  id                 boolean primary key default true,
  active_event_slug  text,
  is_live            boolean not null default false,
  updated_at         timestamptz not null default now(),
  constraint chk_event_settings_singleton check (id)
);

insert into public.event_settings (id, active_event_slug, is_live) values (true, null, false);

create trigger trg_event_settings_updated_at
  before update on public.event_settings
  for each row execute function public.set_updated_at();

-- Public read (the /submit wizard checks this as an unauthenticated
-- customer) -- write is admin-only, same split as products/pools.
alter table public.event_settings enable row level security;

create policy "event_settings_select_anyone"
  on public.event_settings for select
  using (true);

create policy "event_settings_update_admin_only"
  on public.event_settings for update
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================================
-- End of migration 0062_add_in_person_event_intake.sql
-- ============================================================================
