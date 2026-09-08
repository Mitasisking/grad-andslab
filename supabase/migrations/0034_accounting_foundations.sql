-- ============================================================================
-- Migration: 0034_accounting_foundations.sql
--
-- Foundational schema for an accounting system: COGS on products, tax
-- fields on orders, and a double-entry-style ledger. This is schema only --
-- nothing in the app yet writes a ledger_entries row, computes tax, or
-- converts a ZAR/GBP order into its USD ledger equivalent. Those all need
-- real business decisions (a tax rate per region/product, an FX rate or
-- source, which events post which entries) this migration doesn't make.
--
-- Two distinct "currency" ideas now exist in this schema, deliberately not
-- reused for each other:
--   - products.region / orders.region (0031/0032) is the REAL currency a
--     row is priced/charged in (ZAR/USD/GBP) -- what a customer actually
--     pays, never converted.
--   - ledger_currency (this migration) is the accounting REPORTING
--     baseline -- always 'usd', regardless of a row's real region/charge
--     currency, per this request's "restrict the accounting baseline
--     strictly to Dollars". A ZAR order's true financial figures still
--     need converting to USD before they mean anything on this baseline;
--     this migration only adds the column and constrains it to 'usd',
--     it doesn't do that conversion.
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
  add column ledger_currency text not null default 'usd' check (ledger_currency = 'usd');

-- ----------------------------------------------------------------------------
-- 2. Tax tracking: orders.tax_rate / orders.tax_collected
--
-- Both nullable for the same reason as cost_basis -- no tax computation
-- exists in checkout yet (create_order(), 0032_multicurrency_checkout.sql),
-- so every existing and newly-created order has an unknown tax split until
-- that logic is built. tax_rate is a fraction (0.15 = 15%), not a percent.
-- ----------------------------------------------------------------------------
alter table public.orders
  add column tax_rate numeric(5,4) check (tax_rate is null or (tax_rate >= 0 and tax_rate <= 1)),
  add column tax_collected numeric(12,2) check (tax_collected is null or tax_collected >= 0);

alter table public.orders
  add column ledger_currency text not null default 'usd' check (ledger_currency = 'usd');

-- ----------------------------------------------------------------------------
-- 4. Ledger: double-entry-style transaction log
--
-- account_category, not a debit/credit pair -- matches exactly what was
-- asked for. A stricter double-entry model (explicit debit/credit legs
-- that must net to zero per order) is a natural next step but isn't built
-- here; amount is deliberately unconstrained in sign (not "> 0") so it can
-- carry that convention later without a migration to loosen it.
--
-- currency is constrained to 'usd' the same way products/orders'
-- ledger_currency is -- this table IS the reporting baseline, so there's
-- no case where a row here should say anything else.
-- ----------------------------------------------------------------------------
create type public.ledger_account_category as enum ('revenue', 'liability', 'expense', 'cogs', 'tax_payable');

create table public.ledger_entries (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid references public.orders(id) on delete set null,
  account_category public.ledger_account_category not null,
  amount           numeric(12,2) not null,
  currency         text not null default 'usd' check (currency = 'usd'),
  created_at       timestamptz not null default now()
);

create index idx_ledger_entries_order_id on public.ledger_entries(order_id);
create index idx_ledger_entries_account_category on public.ledger_entries(account_category);

-- Admin-only in every direction -- this is internal accounting data, not
-- something a customer's own RLS access to their order should extend to.
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

-- ============================================================================
-- End of migration 0034_accounting_foundations.sql
-- ============================================================================
