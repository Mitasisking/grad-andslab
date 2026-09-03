-- ============================================================================
-- Migration: 0001_init_schema.sql
-- Platform:  TCG Middleman Grading / Marketplace / Auction House
-- Phase 1:   Core schema, enums, relationships, indexes, RLS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. EXTENSIONS
-- ----------------------------------------------------------------------------
create extension if not exists "pgcrypto";      -- gen_random_uuid()
create extension if not exists "pg_trgm";        -- fuzzy search on card_name / title

-- ----------------------------------------------------------------------------
-- 1. ENUM TYPES
-- ----------------------------------------------------------------------------
create type public.user_role            as enum ('user', 'admin');
create type public.grading_company      as enum ('PSA', 'CGC', 'BGS');
create type public.submission_tier      as enum ('economy', 'regular', 'express', 'super_express', 'walk_through');
create type public.submission_status    as enum ('received', 'inspected', 'shipped', 'graded', 'returned');
create type public.precheck_action      as enum ('proceed_regardless', 'return_if_under_target');
create type public.product_category     as enum ('sealed', 'accessories', 'graded');
create type public.auction_status       as enum ('active', 'extended', 'closed');
create type public.payment_status       as enum ('pending', 'authorized', 'captured', 'failed', 'refunded');

-- ----------------------------------------------------------------------------
-- 2. UTILITY: updated_at trigger function
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. TABLE: profiles  (1:1 extension of auth.users)
-- ----------------------------------------------------------------------------
create table public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  full_name         text,
  email             text not null,
  phone             text,
  role              public.user_role not null default 'user',
  shipping_name     text,
  shipping_line1    text,
  shipping_line2    text,
  shipping_city     text,
  shipping_state    text,
  shipping_postal   text,
  shipping_country  text default 'US',
  stripe_customer_id text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_profiles_role on public.profiles(role);

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile row whenever a new auth user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 4. TABLE: submissions  (grading orders)
-- ----------------------------------------------------------------------------
create table public.submissions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles(id) on delete cascade,
  grading_company     public.grading_company not null,
  tier                public.submission_tier not null default 'regular',
  status              public.submission_status not null default 'received',
  tracking_number_in  text,           -- customer -> us
  tracking_number_out text,           -- grader/us -> customer
  courier             text,
  shipping_address_snapshot jsonb,    -- frozen copy of address at time of order
  total_declared_value numeric(12,2) not null default 0 check (total_declared_value >= 0),
  service_fee         numeric(12,2) not null default 0 check (service_fee >= 0),
  payment_status      public.payment_status not null default 'pending',
  stripe_payment_intent_id text,
  qr_code_token       uuid not null default gen_random_uuid(),
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_submissions_user_id on public.submissions(user_id);
create index idx_submissions_status on public.submissions(status);
create index idx_submissions_qr_token on public.submissions(qr_code_token);
create index idx_submissions_created_at on public.submissions(created_at desc);

create trigger trg_submissions_updated_at
  before update on public.submissions
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 5. TABLE: submission_items  (individual cards within a submission)
-- ----------------------------------------------------------------------------
create table public.submission_items (
  id                  uuid primary key default gen_random_uuid(),
  submission_id       uuid not null references public.submissions(id) on delete cascade,
  card_name           text not null,
  set_name            text not null,
  card_number         text,
  declared_value      numeric(12,2) not null default 0 check (declared_value >= 0),
  market_value_estimate numeric(12,2),          -- auto-populated from pricing API
  market_value_source  text,                    -- e.g. 'tcgplayer', 'pricecharting'
  pre_check_opt_in    boolean not null default false,
  precheck_action     public.precheck_action default 'proceed_regardless',
  target_grade        numeric(3,1),              -- e.g. 9.0, only relevant if return_if_under_target
  grade_result        numeric(3,1),
  grade_cert_number   text,
  hi_res_photo_url    text,
  intake_photo_url    text,                       -- photo taken at admin intake
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_submission_items_submission_id on public.submission_items(submission_id);
create index idx_submission_items_card_name_trgm on public.submission_items using gin (card_name gin_trgm_ops);

create trigger trg_submission_items_updated_at
  before update on public.submission_items
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 6. TABLE: products  (e-commerce catalog)
-- ----------------------------------------------------------------------------
create table public.products (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text,
  category      public.product_category not null,
  price         numeric(12,2) not null check (price >= 0),
  stock         integer not null default 0 check (stock >= 0),
  sku           text unique,
  images        text[] not null default '{}',
  is_active     boolean not null default true,
  linked_submission_item_id uuid references public.submission_items(id) on delete set null, -- for 'graded' listings sourced from a submission
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_products_category on public.products(category);
create index idx_products_is_active on public.products(is_active);
create index idx_products_title_trgm on public.products using gin (title gin_trgm_ops);

create trigger trg_products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 7. TABLE: auctions
-- ----------------------------------------------------------------------------
create table public.auctions (
  id                  uuid primary key default gen_random_uuid(),
  item_id             uuid references public.submission_items(id) on delete set null, -- graded card source
  product_id          uuid references public.products(id) on delete set null,         -- optional linked catalog listing
  seller_id           uuid not null references public.profiles(id) on delete cascade,
  title               text not null,
  description         text,
  images              text[] not null default '{}',
  starting_price      numeric(12,2) not null check (starting_price >= 0),
  reserve_price       numeric(12,2) check (reserve_price >= 0),
  bid_increment       numeric(12,2) not null default 1 check (bid_increment > 0),
  current_high_bid    numeric(12,2),
  current_high_bidder_id uuid references public.profiles(id),
  status              public.auction_status not null default 'active',
  starts_at           timestamptz not null default now(),
  ends_at             timestamptz not null,
  extension_count     integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint chk_reserve_gte_start check (reserve_price is null or reserve_price >= starting_price),
  constraint chk_ends_after_start check (ends_at > starts_at)
);

create index idx_auctions_status on public.auctions(status);
create index idx_auctions_ends_at on public.auctions(ends_at);
create index idx_auctions_seller_id on public.auctions(seller_id);
create index idx_auctions_item_id on public.auctions(item_id);

create trigger trg_auctions_updated_at
  before update on public.auctions
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 8. TABLE: bids
-- ----------------------------------------------------------------------------
create table public.bids (
  id            uuid primary key default gen_random_uuid(),
  auction_id    uuid not null references public.auctions(id) on delete cascade,
  bidder_id     uuid not null references public.profiles(id) on delete cascade,
  amount        numeric(12,2) not null check (amount > 0),
  stripe_payment_intent_id text,       -- pre-authorization hold for this bid
  payment_status public.payment_status not null default 'pending',
  created_at    timestamptz not null default now()
);

create index idx_bids_auction_id on public.bids(auction_id);
create index idx_bids_bidder_id on public.bids(bidder_id);
create index idx_bids_auction_created_at on public.bids(auction_id, created_at desc);

-- ============================================================================
-- 9. ROW LEVEL SECURITY
-- ============================================================================

-- Helper: is the current user an admin?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

alter table public.profiles         enable row level security;
alter table public.submissions      enable row level security;
alter table public.submission_items enable row level security;
alter table public.products         enable row level security;
alter table public.auctions         enable row level security;
alter table public.bids             enable row level security;

-- ---- profiles ----
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

create policy "profiles_update_own_or_admin"
  on public.profiles for update
  using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

-- ---- submissions ----
create policy "submissions_select_own_or_admin"
  on public.submissions for select
  using (auth.uid() = user_id or public.is_admin());

create policy "submissions_insert_own"
  on public.submissions for insert
  with check (auth.uid() = user_id);

create policy "submissions_update_own_or_admin"
  on public.submissions for update
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

create policy "submissions_delete_admin_only"
  on public.submissions for delete
  using (public.is_admin());

-- ---- submission_items (access mirrors parent submission) ----
create policy "submission_items_select_own_or_admin"
  on public.submission_items for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.submissions s
      where s.id = submission_items.submission_id and s.user_id = auth.uid()
    )
  );

create policy "submission_items_insert_own_or_admin"
  on public.submission_items for insert
  with check (
    public.is_admin()
    or exists (
      select 1 from public.submissions s
      where s.id = submission_items.submission_id and s.user_id = auth.uid()
    )
  );

create policy "submission_items_update_own_or_admin"
  on public.submission_items for update
  using (
    public.is_admin()
    or exists (
      select 1 from public.submissions s
      where s.id = submission_items.submission_id and s.user_id = auth.uid()
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.submissions s
      where s.id = submission_items.submission_id and s.user_id = auth.uid()
    )
  );

create policy "submission_items_delete_admin_only"
  on public.submission_items for delete
  using (public.is_admin());

-- ---- products (public storefront) ----
create policy "products_select_public_active_or_admin"
  on public.products for select
  using (is_active = true or public.is_admin());

create policy "products_insert_admin_only"
  on public.products for insert
  with check (public.is_admin());

create policy "products_update_admin_only"
  on public.products for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "products_delete_admin_only"
  on public.products for delete
  using (public.is_admin());

-- ---- auctions (public listings, seller/admin manage) ----
create policy "auctions_select_public"
  on public.auctions for select
  using (true);

create policy "auctions_insert_own_or_admin"
  on public.auctions for insert
  with check (auth.uid() = seller_id or public.is_admin());

create policy "auctions_update_own_or_admin"
  on public.auctions for update
  using (auth.uid() = seller_id or public.is_admin())
  with check (auth.uid() = seller_id or public.is_admin());

create policy "auctions_delete_admin_only"
  on public.auctions for delete
  using (public.is_admin());

-- ---- bids (public bid history, users insert their own) ----
create policy "bids_select_public"
  on public.bids for select
  using (true);

create policy "bids_insert_own"
  on public.bids for insert
  with check (auth.uid() = bidder_id);

create policy "bids_update_admin_only"
  on public.bids for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "bids_delete_admin_only"
  on public.bids for delete
  using (public.is_admin());

-- ============================================================================
-- End of migration 0001_init_schema.sql
-- ============================================================================