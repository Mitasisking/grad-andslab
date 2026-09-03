-- ============================================================================
-- Migration: 0002_addresses.sql
-- Adds a dedicated addresses table (multi-address support) and links it to
-- submissions as a live reference, alongside the existing frozen JSON
-- snapshot captured at order time.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TABLE: addresses
-- ----------------------------------------------------------------------------
create table public.addresses (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  label         text not null default 'Address',
  full_name     text not null,
  line1         text not null,
  line2         text,
  city          text not null,
  state         text not null,
  postal        text not null,
  country       text not null default 'US',
  is_default    boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_addresses_user_id on public.addresses(user_id);

create trigger trg_addresses_updated_at
  before update on public.addresses
  for each row execute function public.set_updated_at();

-- Enforce at most one default address per user at the database level.
create unique index uq_addresses_one_default_per_user
  on public.addresses(user_id)
  where (is_default);

-- ----------------------------------------------------------------------------
-- 2. RLS: addresses
-- ----------------------------------------------------------------------------
alter table public.addresses enable row level security;

create policy "addresses_select_own_or_admin"
  on public.addresses for select
  using (auth.uid() = user_id or public.is_admin());

create policy "addresses_insert_own"
  on public.addresses for insert
  with check (auth.uid() = user_id);

create policy "addresses_update_own_or_admin"
  on public.addresses for update
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

create policy "addresses_delete_own_or_admin"
  on public.addresses for delete
  using (auth.uid() = user_id or public.is_admin());

-- ----------------------------------------------------------------------------
-- 3. Link submissions -> addresses. The existing shipping_address_snapshot
--    jsonb column remains the frozen record of the address as it was at
--    order time (addresses can change or be deleted later); address_id is a
--    live reference back to the source row for joins/admin lookups.
-- ----------------------------------------------------------------------------
alter table public.submissions
  add column address_id uuid references public.addresses(id) on delete set null;

create index idx_submissions_address_id on public.submissions(address_id);

-- ----------------------------------------------------------------------------
-- 4. Retire the flat shipping_* columns on profiles now that public.addresses
--    is the source of truth. In an environment with real rows, backfill
--    those values into public.addresses before running this step.
-- ----------------------------------------------------------------------------
alter table public.profiles
  drop column if exists shipping_name,
  drop column if exists shipping_line1,
  drop column if exists shipping_line2,
  drop column if exists shipping_city,
  drop column if exists shipping_state,
  drop column if exists shipping_postal,
  drop column if exists shipping_country;

-- ============================================================================
-- End of migration 0002_addresses.sql
-- ============================================================================
