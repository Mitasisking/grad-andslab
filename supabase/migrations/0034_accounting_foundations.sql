-- ============================================================================
-- Migration: 0034_accounting_foundations.sql
--
-- Foundational schema for an accounting system: COGS on products, tax/FX
-- fields on orders and submissions, a wholesale-cost matrix per grading
-- company/tier, and a double-entry-style ledger.
--
-- Two distinct "currency" ideas exist in this schema, deliberately not
-- reused for each other:
--   - products.region / orders.region / submissions.region is the REAL
--     currency a row is priced/charged in (ZAR/USD/GBP) -- what a customer
--     actually pays, never converted.
--   - ledger_currency is the accounting REPORTING baseline -- always
--     'zar' (this business is South Africa based; see this request's own
--     correction from an earlier USD-baseline draft). exchange_rate_to_zar
--     is what actually bridges the two: a row's real-currency amount times
--     its own exchange_rate_to_zar is that row's ZAR-equivalent.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. COGS: products.cost_basis
--
-- Nullable, not defaulted to 0 -- this catalog has 400+ existing rows with
-- no known cost basis, and a false "0" would silently read as 100% margin
-- on every unpriced product. Filled in per-product as real costs are known.
-- ----------------------------------------------------------------------------
alter table public.products
  add column cost_basis numeric(12,2) check (cost_basis is null or cost_basis >= 0);

alter table public.products
  add column ledger_currency text not null default 'zar' check (ledger_currency = 'zar');

-- ----------------------------------------------------------------------------
-- 2. Tax + FX tracking: orders and submissions
--
-- Nullable for the same reason as cost_basis on existing rows -- neither
-- column existed before this migration, so every pre-existing row has an
-- unknown tax/FX split. Newly-created rows get real values stamped by
-- create_order() below (shop orders) and app/api/submissions/route.ts
-- (grading submissions) -- tax_rate is a fraction (0.20 = 20%), not a
-- percent, and doesn't change what the customer is charged; it's a
-- bookkeeping figure computed from lib/shop/product-type.ts's
-- REGION_TAX_RATE / REGION_EXCHANGE_RATE_TO_ZAR, both explicitly
-- placeholder/static per the business's own instruction.
-- ----------------------------------------------------------------------------
alter table public.orders
  add column tax_rate numeric(5,4) check (tax_rate is null or (tax_rate >= 0 and tax_rate <= 1)),
  add column tax_collected numeric(12,2) check (tax_collected is null or tax_collected >= 0),
  add column exchange_rate_to_zar numeric(10,6) check (exchange_rate_to_zar is null or exchange_rate_to_zar > 0);

alter table public.orders
  add column ledger_currency text not null default 'zar' check (ledger_currency = 'zar');

alter table public.submissions
  add column tax_rate numeric(5,4) check (tax_rate is null or (tax_rate >= 0 and tax_rate <= 1)),
  add column tax_collected numeric(12,2) check (tax_collected is null or tax_collected >= 0),
  add column exchange_rate_to_zar numeric(10,6) check (exchange_rate_to_zar is null or exchange_rate_to_zar > 0);

alter table public.submissions
  add column ledger_currency text not null default 'zar' check (ledger_currency = 'zar');

-- ----------------------------------------------------------------------------
-- 3. create_order() now stamps tax_rate/tax_collected/exchange_rate_to_zar
--    on every shop order, computed from the region it already resolves
--    (0032_multicurrency_checkout.sql). Inlined as a CASE rather than a
--    separate SQL helper function, since lib/shop/product-type.ts's
--    REGION_TAX_RATE/REGION_EXCHANGE_RATE_TO_ZAR are the ones anything
--    TypeScript-side (app/api/submissions/route.ts) actually reads --
--    these two need to be kept in sync by hand if the rates ever change.
--    tax_collected is a simple flat-rate figure applied to the order's own
--    total (subtotal + shipping), not a proper inclusive/exclusive VAT
--    extraction -- a first-draft approximation, same spirit as PCG's own
--    basePriceUSD conversion note.
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
  v_region public.product_region;
  v_tax_rate numeric(5,4);
  v_exchange_rate numeric(10,6);
  v_total numeric(12,2);
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
  -- makes the check-then-reserve atomic — nothing else can touch these
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

    if v_region is null then
      v_region := v_product.region;
    elsif v_region is distinct from v_product.region then
      raise exception 'Your cart has items from more than one region — please check out one region at a time.';
    end if;

    v_subtotal := v_subtotal + v_product.price * (v_item ->> 'quantity')::integer;
  end loop;

  v_total := v_subtotal + coalesce(p_shipping_cost, 0);

  -- Placeholder rates, kept in sync by hand with lib/shop/product-type.ts's
  -- REGION_TAX_RATE / REGION_EXCHANGE_RATE_TO_ZAR -- see this migration's
  -- header comment.
  v_tax_rate := case v_region when 'uk' then 0.20 when 'sa' then 0.15 else 0 end;
  v_exchange_rate := case v_region when 'sa' then 1 when 'usa' then 18.5 when 'uk' then 18.5 / 0.79 end;

  insert into public.orders (
    user_id, address_id, shipping_address_snapshot, status, subtotal, shipping_cost, total, payment_status,
    region, tax_rate, tax_collected, exchange_rate_to_zar
  )
  values (
    v_user_id,
    p_address_id,
    to_jsonb(v_address),
    'pending',
    v_subtotal,
    coalesce(p_shipping_cost, 0),
    v_total,
    'pending',
    v_region,
    v_tax_rate,
    round(v_total * v_tax_rate, 2),
    v_exchange_rate
  )
  returning * into v_order;

  -- Pass 2: write the line items and reserve the stock in the same
  -- transaction as pass 1's check — still holding pass 1's locks.
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

-- ----------------------------------------------------------------------------
-- 4. Wholesale cost matrix: what Cuppa Cards actually pays each grading
--    company per tier -- NOT tracked anywhere else in this codebase (only
--    what customers are charged is: lib/submission-types.ts's
--    basePriceUSD/GBP/ZAR). A flat number can't represent this, since cost
--    genuinely depends on both which company AND which tier -- PCG
--    Express and PSA Express are entirely different wholesale prices.
--
--    Seeded with every real (grading_company, tier) combination that
--    exists today, wholesale_cost_zar left null on every row -- fill in
--    real costs directly with UPDATE statements once known; nothing else
--    needs to change for post_submission_ledger_entries() (below) to
--    start posting a real liability split the moment a row here is
--    non-null.
-- ----------------------------------------------------------------------------
create table public.grading_tier_costs (
  grading_company    public.grading_company not null,
  tier               public.submission_tier not null,
  wholesale_cost_zar numeric(12,2) check (wholesale_cost_zar is null or wholesale_cost_zar >= 0),
  updated_at         timestamptz not null default now(),
  primary key (grading_company, tier)
);

create trigger trg_grading_tier_costs_updated_at
  before update on public.grading_tier_costs
  for each row execute function public.set_updated_at();

insert into public.grading_tier_costs (grading_company, tier) values
  ('PCG', 'authentication'),
  ('PCG', 'bulk'),
  ('PCG', 'standard'),
  ('PCG', 'express'),
  ('PSA', 'psa_value_bulk'),
  ('PSA', 'psa_regular'),
  ('PSA', 'psa_express'),
  ('ACE', 'ace_value'),
  ('ACE', 'ace_basic'),
  ('ACE', 'ace_standard');

-- Admin-only -- this is internal cost data, never something a customer's
-- own RLS access should extend to.
alter table public.grading_tier_costs enable row level security;

create policy "grading_tier_costs_select_admin_only"
  on public.grading_tier_costs for select
  using (public.is_admin());

create policy "grading_tier_costs_update_admin_only"
  on public.grading_tier_costs for update
  using (public.is_admin())
  with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 5. Ledger: double-entry-style transaction log
--
-- account_category, not a debit/credit pair -- matches exactly what was
-- asked for. A stricter double-entry model (explicit debit/credit legs
-- that must net to zero per order) is a natural next step but isn't built
-- here; amount is deliberately unconstrained in sign (not "> 0") so it can
-- carry that convention later without a migration to loosen it.
--
-- References a shop order OR a grading submission, never both -- the
-- "revenue vs. liability vs. tax" split this request describes
-- (app/api/submissions/route.ts) is specifically about grading fees, so
-- entries need to point at submissions, not just orders.
--
-- currency is constrained to 'zar' the same way products/orders/
-- submissions' ledger_currency is -- this table IS the reporting baseline,
-- so there's no case where a row here should say anything else.
-- ----------------------------------------------------------------------------
create type public.ledger_account_category as enum ('revenue', 'liability', 'expense', 'cogs', 'tax_payable');

create table public.ledger_entries (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid references public.orders(id) on delete set null,
  submission_id    uuid references public.submissions(id) on delete set null,
  account_category public.ledger_account_category not null,
  amount           numeric(12,2) not null,
  currency         text not null default 'zar' check (currency = 'zar'),
  created_at       timestamptz not null default now(),
  constraint chk_ledger_entries_one_source check (num_nonnulls(order_id, submission_id) <= 1)
);

create index idx_ledger_entries_order_id on public.ledger_entries(order_id);
create index idx_ledger_entries_submission_id on public.ledger_entries(submission_id);
create index idx_ledger_entries_account_category on public.ledger_entries(account_category);

-- Admin-only in every direction -- this is internal accounting data, not
-- something a customer's own RLS access to their order/submission should
-- extend to.
alter table public.ledger_entries enable row level security;

create policy "ledger_entries_select_admin_only"
  on public.ledger_entries for select
  using (public.is_admin());

create policy "ledger_entries_insert_admin_only"
  on public.ledger_entries for insert
  with check (public.is_admin());

create policy "ledger_entries_update_admin_only"
  on public.ledger_entries for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "ledger_entries_delete_admin_only"
  on public.ledger_entries for delete
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- 6. post_submission_ledger_entries(): the write path for a grading
--    submission's revenue/liability/tax split (app/api/submissions/
--    route.ts). ledger_entries' own RLS is admin-only in every direction
--    (see above) -- a customer creating their own submission isn't an
--    admin, so a plain session-scoped insert from that route would be
--    rejected. security definer, same as create_order(), so it runs with
--    the privilege to write regardless of the caller's own role, while
--    still checking auth.uid() itself and that the submission actually
--    belongs to the caller, so this can't be used to post entries against
--    someone else's submission.
--
--    The liability lookup lives here, not in the calling route -- looks up
--    grading_tier_costs by (p_grading_company, p_tier) itself, so filling
--    in a real wholesale_cost_zar there is the ONLY change needed to make
--    the split real; nothing about app/api/submissions/route.ts needs to
--    change. Every row's wholesale_cost_zar is null today, so liability
--    posts as 0 (skipped) and the whole post-tax fee is revenue -- not a
--    fabricated split with no real number behind it.
-- ----------------------------------------------------------------------------
create or replace function public.post_submission_ledger_entries(
  p_submission_id uuid,
  p_grading_company public.grading_company,
  p_tier public.submission_tier,
  p_fee_zar numeric,
  p_tax_collected_zar numeric
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_wholesale_cost_zar numeric;
  v_liability_zar numeric;
  v_revenue_zar numeric;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  perform 1 from public.submissions where id = p_submission_id and user_id = v_user_id;
  if not found then
    raise exception 'Submission not found for this account';
  end if;

  select wholesale_cost_zar into v_wholesale_cost_zar
    from public.grading_tier_costs
    where grading_company = p_grading_company and tier = p_tier;

  v_liability_zar := coalesce(v_wholesale_cost_zar, 0);
  v_revenue_zar := p_fee_zar - p_tax_collected_zar - v_liability_zar;

  if p_tax_collected_zar > 0 then
    insert into public.ledger_entries (submission_id, account_category, amount)
    values (p_submission_id, 'tax_payable', p_tax_collected_zar);
  end if;

  if v_liability_zar > 0 then
    insert into public.ledger_entries (submission_id, account_category, amount)
    values (p_submission_id, 'liability', v_liability_zar);
  end if;

  if v_revenue_zar <> 0 then
    insert into public.ledger_entries (submission_id, account_category, amount)
    values (p_submission_id, 'revenue', v_revenue_zar);
  end if;
end;
$$;

-- ============================================================================
-- End of migration 0034_accounting_foundations.sql
-- ============================================================================
