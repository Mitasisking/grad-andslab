-- ============================================================================
-- Migration: 0030_add_contact_inquiries.sql
--
-- Backs the new /contact page's form (app/contact/page.tsx,
-- app/api/contact-inquiries/route.ts). Same shape as
-- 0024_add_vendor_inquiries.sql's vendor_inquiries table: submitted while
-- signed out, so the insert policy allows the anonymous role rather than
-- checking auth.uid(), and only admins can read/update/delete.
-- ============================================================================

create table public.contact_inquiries (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 200),
  email       text not null check (char_length(email) between 1 and 320),
  subject     text not null check (char_length(subject) between 1 and 200),
  message     text not null check (char_length(message) between 1 and 5000),
  status      text not null default 'new' check (status in ('new', 'read', 'replied')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_contact_inquiries_created_at on public.contact_inquiries(created_at desc);

create trigger trg_contact_inquiries_updated_at
  before update on public.contact_inquiries
  for each row execute function public.set_updated_at();

alter table public.contact_inquiries enable row level security;

-- Anyone (including signed-out visitors) can submit a message, but only
-- through app/api/contact-inquiries/route.ts's own validation -- this policy
-- just governs the database side, matching the honeypot/length checks that
-- route enforces before ever reaching this insert.
create policy "contact_inquiries_insert_anyone"
  on public.contact_inquiries for insert
  with check (true);

-- No one can read, update, or delete messages through the public API --
-- only admins, via the same public.is_admin() helper every other
-- admin-only table in this schema uses.
create policy "contact_inquiries_select_admin_only"
  on public.contact_inquiries for select
  using (public.is_admin());

create policy "contact_inquiries_update_admin_only"
  on public.contact_inquiries for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "contact_inquiries_delete_admin_only"
  on public.contact_inquiries for delete
  using (public.is_admin());

-- ============================================================================
-- End of migration 0030_add_contact_inquiries.sql
-- ============================================================================
