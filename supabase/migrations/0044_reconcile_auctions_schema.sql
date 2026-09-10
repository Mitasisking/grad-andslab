-- ============================================================================
-- Migration: 0044_reconcile_auctions_schema.sql
--
-- Closes a major migrations-vs-production drift discovered while checking
-- the auction bidding flow for MAJOR SYSTEMS TEST work: production's
-- public.auctions table was NOT what 0001_init_schema.sql/0006_auctions.sql
-- declare. Confirmed directly against Postgres (information_schema.columns,
-- pg_policies, information_schema.triggers, pg_type), not just the code:
--
--   - auctions had only 10 columns (id, title, description, starting_price,
--     current_bid, highest_bidder, image_url, ends_at, status(text,
--     nullable), created_at) -- none of seller_id, item_id, product_id,
--     images, reserve_price, bid_increment, current_high_bid,
--     current_high_bidder_id, starts_at, extension_count, updated_at
--     existed at all.
--   - Its real, live RLS was NOT the seller-scoped policy set the
--     migrations declare -- it was two ad-hoc, presumably dashboard-created
--     policies: "Anyone can view auctions" (select, harmless) and
--     "Authenticated users can update bids" (UPDATE using (auth.role() =
--     'authenticated'), WITH CHECK NULL). That second one is a real,
--     live vulnerability: any logged-in user could overwrite ANY column on
--     ANY auction, not just place a bid -- confirmed exploitable by
--     app/auctions/page.tsx itself, which does exactly that with a raw
--     client-side .update() instead of going through the real bid API.
--   - None of trg_auctions_updated_at, trg_auctions_protect_system_columns,
--     or trg_profiles_protect_role existed live either, despite
--     0001/0007/0010 declaring them.
--   - profiles was also missing stripe_customer_id and
--     default_payment_method_id (0001/0005), which
--     app/api/auctions/[id]/bid/route.ts already assumes exist.
--   - public.bids, by contrast, already had the exact correct shape --
--     this drift is scoped to auctions/profiles, not bids.
--
-- Net effect before this migration: app/auctions/[id]/page.tsx (the real,
-- Stripe-backed bid flow -- BidForm, anti-sniping, the works) crashed with
-- a 500 for any real auction (confirmed live: `images[0]` on `undefined`),
-- while the public /auctions list page silently worked against the wrong,
-- insecure schema instead.
--
-- This migration reconciles production to what every migration file since
-- 0001 already assumes. Schema check performed live before writing this,
-- per this repo's standing mandate (db-agent.md) to confirm shape against
-- the real database rather than trust the migration files.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. profiles: add the two columns 0001/0005 declare that production never
--    got. Confirmed missing (0 rows) via information_schema.columns before
--    writing this.
-- ----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists stripe_customer_id text,
  add column if not exists default_payment_method_id text;

-- ----------------------------------------------------------------------------
-- 2. auctions: add every column 0001/0006 declare that production is
--    missing. Nullable/defaulted first -- NOT NULL constraints follow once
--    the two existing rows are backfilled in step 3.
-- ----------------------------------------------------------------------------
alter table public.auctions
  add column if not exists seller_id uuid references public.profiles(id) on delete cascade,
  add column if not exists item_id uuid references public.submission_items(id) on delete set null,
  add column if not exists product_id uuid references public.products(id) on delete set null,
  add column if not exists images text[] not null default '{}',
  add column if not exists reserve_price numeric(12,2) check (reserve_price >= 0),
  add column if not exists bid_increment numeric(12,2) not null default 1 check (bid_increment > 0),
  add column if not exists current_high_bid numeric(12,2),
  add column if not exists current_high_bidder_id uuid references public.profiles(id),
  add column if not exists starts_at timestamptz,
  add column if not exists extension_count integer not null default 0,
  add column if not exists updated_at timestamptz not null default now();

-- ----------------------------------------------------------------------------
-- 3. Backfill the two existing rows (both predate any real seller/bidder
--    model -- this project currently has exactly one profile, the admin
--    account) so the NOT NULL constraints in step 4 can be applied:
--      - seller_id: attributed to the one existing admin account. There is
--        no real seller concept to backfill from; every auction created
--        after this migration goes through the real flow with a real
--        seller_id from the start.
--      - images: carries the old image_url forward as a one-element array.
--      - current_high_bid: carries the old current_bid forward as-is.
--      - current_high_bidder_id: deliberately LEFT NULL. The old
--        highest_bidder column is a free-typed display name (e.g.
--        "CollectorZA"), not a real account reference -- there is no
--        reliable way to resolve that back to a real profiles.id, and
--        guessing would be worse than leaving it unset. The next real bid
--        on each auction sets this correctly via record_auction_bid_result()
--        (0045_fix_auction_bid_race_condition.sql).
--      - starts_at: backfilled from created_at, the closest real timestamp
--        either row actually has to when it was listed.
--    The old current_bid/highest_bidder/image_url/status(-was-text) columns
--    are deliberately NOT dropped here -- see this file's closing comment.
-- ----------------------------------------------------------------------------
update public.auctions
set
  seller_id = coalesce(seller_id, (select id from public.profiles where role = 'admin' order by created_at limit 1)),
  images = case when array_length(images, 1) is null and image_url is not null then array[image_url] else images end,
  current_high_bid = coalesce(current_high_bid, current_bid),
  starts_at = coalesce(starts_at, created_at);

-- ----------------------------------------------------------------------------
-- 4. NOT NULL constraints, defaults, and the status text -> enum conversion
--    0001 declares. auction_status already exists live (active, extended,
--    closed -- confirmed via pg_type before writing this) and both existing
--    rows' status values ('active') are already valid labels, so this
--    conversion is safe.
-- ----------------------------------------------------------------------------
alter table public.auctions
  alter column seller_id set not null,
  alter column starts_at set not null,
  alter column starts_at set default now();

-- The live column has its own text default ('active'::text) that Postgres
-- can't auto-cast to the enum -- drop it first, convert, then set the real
-- enum default. Confirmed live via information_schema.columns before
-- writing this (a first attempt at this migration failed here with exactly
-- that error, caught before anything else in this script was touched --
-- the whole script runs as one transaction, so that failure rolled back
-- cleanly with zero partial effect).
alter table public.auctions
  alter column status drop default;

alter table public.auctions
  alter column status type public.auction_status using status::public.auction_status,
  alter column status set not null,
  alter column status set default 'active';

alter table public.auctions
  add constraint chk_reserve_gte_start check (reserve_price is null or reserve_price >= starting_price),
  add constraint chk_ends_after_start check (ends_at > starts_at);

-- ----------------------------------------------------------------------------
-- 5. Indexes 0001 declares.
-- ----------------------------------------------------------------------------
create index if not exists idx_auctions_status on public.auctions(status);
create index if not exists idx_auctions_ends_at on public.auctions(ends_at);
create index if not exists idx_auctions_seller_id on public.auctions(seller_id);
create index if not exists idx_auctions_item_id on public.auctions(item_id);

-- ----------------------------------------------------------------------------
-- 6. updated_at trigger (0001). set_updated_at() already exists live
--    (confirmed via pg_proc before writing this).
-- ----------------------------------------------------------------------------
drop trigger if exists trg_auctions_updated_at on public.auctions;
create trigger trg_auctions_updated_at
  before update on public.auctions
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 7. System-column protection (0007_rls_hardening.sql). Confirmed this
--    trigger did not exist live before this migration.
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
-- 8. Role-escalation / payment-column protection on profiles
--    (0007_rls_hardening.sql + 0010_rls_hardening_low.sql's extension,
--    written here as the final combined body directly -- confirmed neither
--    version existed live before this migration).
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

drop trigger if exists trg_profiles_protect_role on public.profiles;
create trigger trg_profiles_protect_role
  before update on public.profiles
  for each row execute function public.prevent_self_role_escalation();

-- ----------------------------------------------------------------------------
-- 9. RLS: replace the two ad-hoc policies actually live today with the real
--    policy set 0001 declares. "Authenticated users can update bids"
--    (UPDATE using (auth.role() = 'authenticated'), no WITH CHECK at all)
--    is the live vulnerability this migration closes -- confirmed via
--    pg_policies before writing this.
-- ----------------------------------------------------------------------------
drop policy if exists "Anyone can view auctions" on public.auctions;
drop policy if exists "Authenticated users can update bids" on public.auctions;
drop policy if exists "auctions_select_public" on public.auctions;
drop policy if exists "auctions_insert_own_or_admin" on public.auctions;
drop policy if exists "auctions_update_own_or_admin" on public.auctions;
drop policy if exists "auctions_delete_admin_only" on public.auctions;

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

-- ----------------------------------------------------------------------------
-- 10. bids: drop the client-facing insert policy 0007_rls_hardening.sql
--     already decided to close. Confirmed still live via pg_policies before
--     this migration -- it never actually got dropped. Every real bid
--     insert goes through finalizeAuthorizedBid()'s service-role client,
--     which bypasses RLS entirely, so no client-facing insert policy is
--     needed, and its presence is a live way to fabricate a bid (arbitrary
--     amount, fake stripe_payment_intent_id, payment_status straight to
--     'captured') without ever touching Stripe.
-- ----------------------------------------------------------------------------
drop policy if exists "bids_insert_own" on public.bids;

-- ============================================================================
-- Deliberately NOT done here:
--   - Dropping the old current_bid/highest_bidder/image_url columns. They're
--     superseded by current_high_bid/current_high_bidder_id/images above,
--     but dropping a live production column is its own deliberate decision
--     (db-agent.md's own standing rule) -- do it only once
--     app/auctions/page.tsx (fixed separately to read the new columns) and
--     anything else has been confirmed switched over and running cleanly.
--   - Resolving current_high_bidder_id for the two pre-existing rows -- see
--     step 3's comment.
-- ============================================================================
