-- ============================================================================
-- Migration: 0024_add_vendor_inquiries.sql
--
-- Backs the new /vendor page's "Book Us" form (app/vendor/page.tsx,
-- app/api/vendor-inquiries/route.ts) -- event organizers submit this while
-- signed out, so unlike every other user-facing table in this schema, the
-- insert policy below has to allow the anonymous role rather than checking
-- auth.uid(). Reads are admin-only, same as every other operational table
-- (see public.is_admin(), defined in 0001_init_schema.sql).
-- ============================================================================

create table public.vendor_inquiries (
  id              uuid primary key default gen_random_uuid(),
  organizer_name  text not null check (char_length(organizer_name) between 1 and 200),
  email           text not null check (char_length(email) between 1 and 320),
  event_name      text not null check (char_length(event_name) between 1 and 200),
  event_date      date not null,
  location        text not null check (char_length(location) between 1 and 200),
  message         text not null check (char_length(message) between 1 and 5000),
  status          text not null default 'new' check (status in ('new', 'contacted', 'booked', 'declined')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_vendor_inquiries_created_at on public.vendor_inquiries(created_at desc);

create trigger trg_vendor_inquiries_updated_at
  before update on public.vendor_inquiries
  for each row execute function public.set_updated_at();

alter table public.vendor_inquiries enable row level security;

-- Anyone (including signed-out visitors) can submit an inquiry, but only
-- through app/api/vendor-inquiries/route.ts's own validation -- this policy
-- just governs the database side, matching the honeypot/length checks that
-- route enforces before ever reaching this insert.
create policy "vendor_inquiries_insert_anyone"
  on public.vendor_inquiries for insert
  with check (true);

-- No one can read, update, or delete inquiries through the public API --
-- only admins, via the same public.is_admin() helper every other
-- admin-only table in this schema uses.
create policy "vendor_inquiries_select_admin_only"
  on public.vendor_inquiries for select
  using (public.is_admin());

create policy "vendor_inquiries_update_admin_only"
  on public.vendor_inquiries for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "vendor_inquiries_delete_admin_only"
  on public.vendor_inquiries for delete
  using (public.is_admin());

-- ============================================================================
-- End of migration 0024_add_vendor_inquiries.sql
-- ============================================================================
