-- Combined migration run: 0001 through 0010 (0003 was never delivered as a
-- separate file -- its content, the submission-photos storage bucket, is in 0010).
-- Generated for a one-time apply against a fresh project. Wrapped in a single
-- transaction so a failure partway through leaves nothing half-applied.
begin;

-- ============================== 0001_init_schema.sql ==============================
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

-- ============================== 0002_addresses.sql ==============================
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


-- ============================== 0004_status_history.sql ==============================
-- ============================================================================
-- Migration: 0004_status_history.sql
-- Adds an audit trail table for submission status transitions. Backs the
-- admin status override (jumping stages, moving backward) with a required
-- reason on record, and also logs the initial 'received' state at order
-- creation time for a complete history.
-- ============================================================================

create table public.submission_status_log (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  from_status   public.submission_status,
  to_status     public.submission_status not null,
  changed_by    uuid not null references public.profiles(id),
  reason        text,
  created_at    timestamptz not null default now()
);

create index idx_submission_status_log_submission_id
  on public.submission_status_log(submission_id, created_at);

alter table public.submission_status_log enable row level security;

-- Admins can see every transition; customers can see the history of their
-- own submissions (read-only, for transparency).
create policy "status_log_select_own_or_admin"
  on public.submission_status_log for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.submissions s
      where s.id = submission_status_log.submission_id and s.user_id = auth.uid()
    )
  );

-- Admins can log any transition (routine advances and overrides alike).
-- The submission owner may also insert â€” needed only for the single
-- 'received' entry written at order-creation time in /api/submissions.
create policy "status_log_insert_admin_or_owner"
  on public.submission_status_log for insert
  with check (
    public.is_admin()
    or exists (
      select 1 from public.submissions s
      where s.id = submission_status_log.submission_id and s.user_id = auth.uid()
    )
  );

-- ============================================================================
-- End of migration 0004_status_history.sql
-- ============================================================================


-- ============================== 0005_marketplace.sql ==============================
-- ============================================================================
-- Migration: 0005_marketplace.sql
-- Adds orders/order_items for e-commerce checkout, a saved default payment
-- method on profiles (so auction bidders aren't asked to re-enter a card on
-- every bid), and an atomic stock-decrement function used on order payment.
-- ============================================================================

create type public.order_status as enum ('pending', 'paid', 'fulfilled', 'cancelled');

create table public.orders (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null references public.profiles(id) on delete cascade,
  address_id                uuid references public.addresses(id) on delete set null,
  shipping_address_snapshot jsonb,
  status                    public.order_status not null default 'pending',
  subtotal                  numeric(12,2) not null default 0 check (subtotal >= 0),
  shipping_cost             numeric(12,2) not null default 0 check (shipping_cost >= 0),
  total                     numeric(12,2) not null default 0 check (total >= 0),
  payment_status            public.payment_status not null default 'pending',
  stripe_payment_intent_id  text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index idx_orders_user_id on public.orders(user_id);
create index idx_orders_status on public.orders(status);

create trigger trg_orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create table public.order_items (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  product_id  uuid references public.products(id) on delete set null,
  title       text not null,      -- snapshot: survives later product edits/deletion
  unit_price  numeric(12,2) not null check (unit_price >= 0),
  quantity    integer not null check (quantity > 0),
  created_at  timestamptz not null default now()
);

create index idx_order_items_order_id on public.order_items(order_id);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy "orders_select_own_or_admin"
  on public.orders for select
  using (auth.uid() = user_id or public.is_admin());

create policy "orders_insert_own"
  on public.orders for insert
  with check (auth.uid() = user_id);

create policy "orders_update_admin_only"
  on public.orders for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "order_items_select_own_or_admin"
  on public.order_items for select
  using (
    public.is_admin()
    or exists (select 1 from public.orders o where o.id = order_items.order_id and o.user_id = auth.uid())
  );

create policy "order_items_insert_own_or_admin"
  on public.order_items for insert
  with check (
    public.is_admin()
    or exists (select 1 from public.orders o where o.id = order_items.order_id and o.user_id = auth.uid())
  );

-- Saved payment method for off-session auction bidding, so a bidder isn't
-- asked to re-enter their card on every subsequent bid. Set the first time
-- one of their bids successfully authorizes (see lib/auctions/finalize-bid.ts).
alter table public.profiles
  add column default_payment_method_id text;

-- Atomic stock decrement, floor at zero. Called from the Stripe webhook once
-- an order's payment is captured â€” a plain UPDATE from application code
-- would work too, but wrapping it here keeps the floor-at-zero guarantee in
-- one place regardless of caller.
create or replace function public.decrement_product_stock(p_product_id uuid, p_quantity integer)
returns void
language sql
as $$
  update public.products
  set stock = greatest(stock - p_quantity, 0)
  where id = p_product_id;
$$;

-- ============================================================================
-- End of migration 0005_marketplace.sql
-- ============================================================================


-- ============================== 0006_auctions.sql ==============================
-- ============================================================================
-- Migration: 0006_auctions.sql
-- Anti-sniping: a bid placed within the final 30 seconds of an auction
-- extends ends_at by 120 seconds.
--
-- This is implemented as a Postgres trigger rather than a separate
-- serverless function invoked after the bid write. A trigger runs in the
-- same transaction as the bid INSERT and takes a row lock on the auction,
-- so two near-simultaneous last-second bids can't both read a stale
-- ends_at and only one of them apply the extension â€” an external function
-- calling back to update the row afterward would be racing exactly that.
-- ============================================================================

create or replace function public.extend_auction_on_late_bid()
returns trigger
language plpgsql
as $$
declare
  auction_row public.auctions%rowtype;
begin
  select * into auction_row from public.auctions where id = new.auction_id for update;

  if auction_row.status in ('active', 'extended') and now() >= (auction_row.ends_at - interval '30 seconds') then
    update public.auctions
    set ends_at = auction_row.ends_at + interval '120 seconds',
        status = 'extended',
        extension_count = auction_row.extension_count + 1
    where id = new.auction_id;
  end if;

  return new;
end;
$$;

create trigger trg_extend_auction_on_late_bid
  after insert on public.bids
  for each row execute function public.extend_auction_on_late_bid();

-- ============================================================================
-- End of migration 0006_auctions.sql
-- ============================================================================


-- ============================== 0007_rls_hardening.sql ==============================
-- ============================================================================
-- Migration: 0007_rls_hardening.sql
-- Fixes the Critical/High findings from the RLS security audit: every "own
-- row" UPDATE/INSERT policy so far has checked ownership but not which
-- columns an owner may touch, letting a client with nothing but their own
-- JWT write system-controlled columns directly â€” bypassing every
-- Next.js route that was supposed to be the only path to those writes.
--
--   1. profiles: self-service admin escalation via the `role` column.
--   2. auctions: sellers could rewrite their own bid state directly.
--   3. bids: bids could be inserted without ever touching Stripe.
--   4. submissions / submission_items: customers could self-certify grades
--      and payment status.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. profiles: block role changes by anyone but an admin (or the trusted
--    service-role path), without touching the existing "own row" UPDATE
--    policy that legitimately lets a user edit their name/phone/address.
-- ----------------------------------------------------------------------------
create or replace function public.prevent_self_role_escalation()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role
     and auth.role() <> 'service_role'
     and not public.is_admin()
  then
    raise exception 'Only an admin can change a profile''s role';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_protect_role on public.profiles;
create trigger trg_profiles_protect_role
  before update on public.profiles
  for each row execute function public.prevent_self_role_escalation();

-- ----------------------------------------------------------------------------
-- 2. auctions: the seller may still edit listing metadata (title,
--    description, images, reserve_price) up until the auction has its first
--    bid â€” but current_high_bid, current_high_bidder_id, status,
--    extension_count, seller_id, and item_id are system-controlled: written
--    only by lib/auctions/finalize-bid.ts (service role, on a confirmed
--    Stripe hold) or app/api/auctions/close/route.ts (service role, cron).
--    auth.role() = 'service_role' keeps those two paths working unaffected.
-- ----------------------------------------------------------------------------
create or replace function public.protect_auction_system_columns()
returns trigger
language plpgsql
as $$
begin
  if auth.role() = 'service_role' or public.is_admin() then
    return new;
  end if;

  if new.current_high_bid is distinct from old.current_high_bid
     or new.current_high_bidder_id is distinct from old.current_high_bidder_id
     or new.status is distinct from old.status
     or new.extension_count is distinct from old.extension_count
     or new.seller_id is distinct from old.seller_id
     or new.item_id is distinct from old.item_id
  then
    raise exception 'Only the system can change an auction''s bid state';
  end if;

  if old.current_high_bid is not null then
    raise exception 'This listing can no longer be edited once it has a bid';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_auctions_protect_system_columns on public.auctions;
create trigger trg_auctions_protect_system_columns
  before update on public.auctions
  for each row execute function public.protect_auction_system_columns();

-- ----------------------------------------------------------------------------
-- 3. bids: finalizeAuthorizedBid() writes bids with the service-role client,
--    which bypasses RLS entirely â€” nothing in the real bidding flow needs a
--    client-facing INSERT policy on this table. Dropping it closes the only
--    way a bid could be fabricated (arbitrary amount, fake
--    stripe_payment_intent_id, payment_status set straight to 'captured')
--    without ever touching Stripe. bids_select_public (read) is untouched.
-- ----------------------------------------------------------------------------
drop policy if exists "bids_insert_own" on public.bids;

-- ----------------------------------------------------------------------------
-- 4. submissions / submission_items: no code path in the app updates either
--    table as the owning customer â€” every real status/grade change goes
--    through requireAdmin()-gated routes (admin/intake/status,
--    admin/grading/save), whose session-scoped client already satisfies
--    is_admin(). Dropping the "own" branch removes the client's ability to
--    self-mark payment_status = 'captured' or fabricate a grade_result.
-- ----------------------------------------------------------------------------
drop policy if exists "submissions_update_own_or_admin" on public.submissions;
create policy "submissions_update_admin_only"
  on public.submissions for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "submission_items_update_own_or_admin" on public.submission_items;
create policy "submission_items_update_admin_only"
  on public.submission_items for update
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================================
-- End of migration 0007_rls_hardening.sql
-- ============================================================================


-- ============================== 0008_rls_hardening_medium.sql ==============================
-- ============================================================================
-- Migration: 0008_rls_hardening_medium.sql
-- Fixes the Medium findings from the RLS security audit:
--
--   5. submission_status_log: the owner-insert branch let a customer forge
--      audit-trail entries (changed_by was never pinned to auth.uid()) for
--      a feature â€” the initial 'received' log row â€” that app/api/submissions
--      never actually wrote. Replaced with a trigger that writes that row
--      itself, so no client-facing insert permission is needed at all.
--
--   6. orders / order_items: a client could insert an order directly with
--      an attacker-chosen total/subtotal/unit_price, bypassing the
--      stock/price re-verification app/api/shop/orders/route.ts performs.
--      Order creation now goes through create_order(), a SECURITY DEFINER
--      RPC that looks up price/stock from public.products itself â€” the
--      client can only ever supply product ids and quantities. This also
--      makes creation atomic (orders + order_items in one transaction),
--      fixing the partial-insert risk the old two-step app code had.
--      NOTE: app/api/shop/orders/route.ts must call this RPC instead of
--      inserting directly, or it will start failing once this migration
--      lands â€” see the accompanying code change.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 5. submission_status_log
-- ----------------------------------------------------------------------------
create or replace function public.log_initial_submission_status()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.submission_status_log (submission_id, from_status, to_status, changed_by, reason)
  values (new.id, null, new.status, new.user_id, 'Submission created');
  return new;
end;
$$;

drop trigger if exists trg_submissions_log_initial_status on public.submissions;
create trigger trg_submissions_log_initial_status
  after insert on public.submissions
  for each row execute function public.log_initial_submission_status();

drop policy if exists "status_log_insert_admin_or_owner" on public.submission_status_log;
create policy "status_log_insert_admin_only"
  on public.submission_status_log for insert
  with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 6. orders / order_items
-- ----------------------------------------------------------------------------
create or replace function public.create_order(
  p_address_id uuid,
  p_shipping_cost numeric,
  p_items jsonb -- [{ "product_id": "...", "quantity": 2 }, ...]
)
returns public.orders
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_address public.addresses%rowtype;
  v_item jsonb;
  v_product public.products%rowtype;
  v_subtotal numeric(12,2) := 0;
  v_order public.orders%rowtype;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Cart is empty';
  end if;

  select * into v_address from public.addresses where id = p_address_id and user_id = v_user_id;
  if not found then
    raise exception 'Address not found for this account';
  end if;

  -- Verify stock/price for every line before writing anything.
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_product from public.products
      where id = (v_item ->> 'product_id')::uuid and is_active = true;

    if not found then
      raise exception 'A product in your cart is no longer available';
    end if;
    if v_product.stock < (v_item ->> 'quantity')::integer then
      raise exception 'Not enough stock for "%"', v_product.title;
    end if;

    v_subtotal := v_subtotal + v_product.price * (v_item ->> 'quantity')::integer;
  end loop;

  insert into public.orders (user_id, address_id, shipping_address_snapshot, status, subtotal, shipping_cost, total, payment_status)
  values (
    v_user_id,
    p_address_id,
    to_jsonb(v_address),
    'pending',
    v_subtotal,
    coalesce(p_shipping_cost, 0),
    v_subtotal + coalesce(p_shipping_cost, 0),
    'pending'
  )
  returning * into v_order;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_product from public.products where id = (v_item ->> 'product_id')::uuid;

    insert into public.order_items (order_id, product_id, title, unit_price, quantity)
    values (v_order.id, v_product.id, v_product.title, v_product.price, (v_item ->> 'quantity')::integer);
  end loop;

  return v_order;
end;
$$;

grant execute on function public.create_order(uuid, numeric, jsonb) to authenticated;

drop policy if exists "orders_insert_own" on public.orders;
create policy "orders_insert_admin_only"
  on public.orders for insert
  with check (public.is_admin());

drop policy if exists "order_items_insert_own_or_admin" on public.order_items;
create policy "order_items_insert_admin_only"
  on public.order_items for insert
  with check (public.is_admin());

-- ============================================================================
-- End of migration 0008_rls_hardening_medium.sql
-- ============================================================================


-- ============================== 0009_stock_reservation.sql ==============================
-- ============================================================================
-- Migration: 0009_stock_reservation.sql
-- Fixes the stock race left by 0008: create_order() checked stock but never
-- held it, so two concurrent orders for the last unit could both pass the
-- check â€” nothing was actually reserved until payment capture, by which
-- point it's too late to tell the second customer their cart won't fulfill.
--
-- The fix has two halves:
--   1. create_order() now locks each product row (SELECT ... FOR UPDATE)
--      before checking stock, and decrements it immediately as part of the
--      same transaction â€” the reservation happens atomically with the
--      check, so a second concurrent order genuinely cannot also succeed
--      for the same last unit.
--   2. Since stock is now held from the moment of order creation, an order
--      that's never paid has to give it back. Two release paths, both
--      calling the new release_order_stock():
--        a. Stripe's payment_intent.payment_failed â€” the webhook already
--           sees this (see the accompanying code change).
--        b. A cart that's abandoned before ever attempting payment, so no
--           Stripe event fires at all â€” handled by a new cron-invoked
--           sweep, app/api/shop/orders/release-stale/route.ts, the same
--           shape as the existing app/api/auctions/close/route.ts.
--
-- decrement_product_stock() (0005) is left in place but is no longer called
-- from the webhook now that reservation happens at creation time instead of
-- capture time â€” kept as a general-purpose helper (e.g. a future manual
-- admin stock adjustment), just not part of this flow anymore.
-- ============================================================================

create or replace function public.create_order(
  p_address_id uuid,
  p_shipping_cost numeric,
  p_items jsonb -- [{ "product_id": "...", "quantity": 2 }, ...]
)
returns public.orders
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_address public.addresses%rowtype;
  v_item jsonb;
  v_product public.products%rowtype;
  v_subtotal numeric(12,2) := 0;
  v_order public.orders%rowtype;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Cart is empty';
  end if;

  select * into v_address from public.addresses where id = p_address_id and user_id = v_user_id;
  if not found then
    raise exception 'Address not found for this account';
  end if;

  -- Pass 1: lock every product row up front, in a consistent order (by id)
  -- so two orders sharing products can't deadlock waiting on each other's
  -- locks in opposite order. Holding the lock across both passes is what
  -- makes the check-then-reserve atomic â€” nothing else can touch these
  -- rows until this transaction commits or rolls back.
  for v_item in
    select elem from jsonb_array_elements(p_items) as elem
    order by elem ->> 'product_id'
  loop
    select * into v_product from public.products
      where id = (v_item ->> 'product_id')::uuid and is_active = true
      for update;

    if not found then
      raise exception 'A product in your cart is no longer available';
    end if;
    if v_product.stock < (v_item ->> 'quantity')::integer then
      raise exception 'Not enough stock for "%"', v_product.title;
    end if;

    v_subtotal := v_subtotal + v_product.price * (v_item ->> 'quantity')::integer;
  end loop;

  insert into public.orders (user_id, address_id, shipping_address_snapshot, status, subtotal, shipping_cost, total, payment_status)
  values (
    v_user_id,
    p_address_id,
    to_jsonb(v_address),
    'pending',
    v_subtotal,
    coalesce(p_shipping_cost, 0),
    v_subtotal + coalesce(p_shipping_cost, 0),
    'pending'
  )
  returning * into v_order;

  -- Pass 2: write the line items and reserve the stock in the same
  -- transaction as pass 1's check â€” still holding pass 1's locks.
  for v_item in
    select elem from jsonb_array_elements(p_items) as elem
  loop
    select * into v_product from public.products where id = (v_item ->> 'product_id')::uuid;

    insert into public.order_items (order_id, product_id, title, unit_price, quantity)
    values (v_order.id, v_product.id, v_product.title, v_product.price, (v_item ->> 'quantity')::integer);

    update public.products
    set stock = stock - (v_item ->> 'quantity')::integer
    where id = v_product.id;
  end loop;

  return v_order;
end;
$$;

-- Gives back the stock create_order() reserved, for an order that's never
-- going to be paid (failed payment, or abandoned past the reservation
-- window). One statement covers every line item on the order at once.
create or replace function public.release_order_stock(p_order_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.products p
  set stock = p.stock + oi.quantity
  from public.order_items oi
  where oi.order_id = p_order_id
    and oi.product_id = p.id;
end;
$$;

-- Supabase grants EXECUTE on new functions to anon/authenticated by
-- default â€” this one must only ever run from trusted server code (the
-- webhook, the release-stale sweep), never a client picking an arbitrary
-- order id to un-decrement stock on. create_order() doesn't need this
-- treatment since it already validates auth.uid() and ownership itself.
revoke execute on function public.release_order_stock(uuid) from public, anon, authenticated;
grant execute on function public.release_order_stock(uuid) to service_role;

-- ============================================================================
-- End of migration 0009_stock_reservation.sql
-- ============================================================================


-- ============================== 0010_rls_hardening_low.sql ==============================
-- ============================================================================
-- Migration: 0010_rls_hardening_low.sql
-- Fixes the Low/informational findings from the RLS security audit:
--
--   7. profiles: stripe_customer_id / default_payment_method_id were
--      client-writable, same shape as the role-escalation bug 0007 fixed â€”
--      lower severity on its own (Stripe still enforces that a
--      payment_method belongs to its customer at charge time), but if an
--      attacker ever learned a victim's real Stripe ids through some other
--      leak, writing both onto their own profile would let them place a
--      bid that charges the victim's saved card. Extends 0007's trigger
--      rather than adding a second one.
--
--   8. bids: stripe_payment_intent_id was readable by anyone via
--      bids_select_public (using (true)) â€” a payment infrastructure
--      identifier with no legitimate public display use, unlike
--      bidder_id/amount which bid-history.tsx actually renders.
--
--   9. storage: 0003_storage.sql (creates the submission-photos bucket +
--      admin-only write policies) was never delivered, despite
--      app/api/admin/intake/{photo,photo-confirm}/route.ts already assuming
--      it exists. Written here: admin-only write, public read. Public read
--      is a deliberate choice, not a default â€” see the comment below.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 7. profiles: extend the existing role-escalation guard from
--    0007_rls_hardening.sql to also cover these two columns. Not a new
--    trigger â€” CREATE OR REPLACE on the same function name, so the trigger
--    already attached to profiles picks up the new body automatically.
-- ----------------------------------------------------------------------------
create or replace function public.prevent_self_role_escalation()
returns trigger
language plpgsql
as $$
begin
  if auth.role() = 'service_role' or public.is_admin() then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'Only an admin can change a profile''s role';
  end if;

  if new.stripe_customer_id is distinct from old.stripe_customer_id then
    raise exception 'stripe_customer_id is system-controlled';
  end if;

  if new.default_payment_method_id is distinct from old.default_payment_method_id then
    raise exception 'default_payment_method_id is system-controlled';
  end if;

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 8. bids: narrow public read to the columns the UI actually renders.
--    Supabase grants column SELECT to anon/authenticated by default, so
--    this needs an explicit revoke, not just a change to the RLS policy
--    (RLS is row-level; it can't restrict columns on its own).
-- ----------------------------------------------------------------------------
revoke select (stripe_payment_intent_id) on public.bids from anon, authenticated;

-- ----------------------------------------------------------------------------
-- 9. storage: submission-photos bucket.
--
--    Read is public (bucket-level `public = true`, independent of RLS)
--    rather than admin-only or signed-URL-scoped. Deliberate: these photos
--    are served with plain <img src> tags in components/admin/intake-order-
--    panel.tsx (no way to attach an auth header to an <img> request), and
--    the same photo is meant to go fully public anyway the moment the card
--    is listed on auction (components/auctions/auction-draft-form.tsx pre-
--    fills the listing's images straight from hi_res_photo_url). If intake
--    photos should stay private until listed, that's a product decision â€”
--    switch to storage.createSignedUrl() with a real expiry and re-issue it
--    per view, which needs its own follow-up.
--
--    Write (insert/update/delete) is admin-only, matching requireAdmin()
--    already gating the only two routes that touch this bucket.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('submission-photos', 'submission-photos', true)
on conflict (id) do nothing;

drop policy if exists "submission_photos_admin_insert" on storage.objects;
create policy "submission_photos_admin_insert"
  on storage.objects for insert
  with check (bucket_id = 'submission-photos' and public.is_admin());

drop policy if exists "submission_photos_admin_update" on storage.objects;
create policy "submission_photos_admin_update"
  on storage.objects for update
  using (bucket_id = 'submission-photos' and public.is_admin())
  with check (bucket_id = 'submission-photos' and public.is_admin());

drop policy if exists "submission_photos_admin_delete" on storage.objects;
create policy "submission_photos_admin_delete"
  on storage.objects for delete
  using (bucket_id = 'submission-photos' and public.is_admin());

-- ============================================================================
-- End of migration 0010_rls_hardening_low.sql
-- ============================================================================


commit;

