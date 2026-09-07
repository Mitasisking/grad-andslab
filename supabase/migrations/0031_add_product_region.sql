-- ============================================================================
-- Migration: 0031_add_product_region.sql
--
-- Adds public.products.region so a product row can be tagged as USA/UK/SA
-- stock, ahead of the Shop Admin Dashboard (app/admin/shop/) letting an
-- admin assign a region per product. A real Postgres enum, not a text +
-- check constraint -- the region set is small and this project has already
-- hit the exact failure mode a hand-maintained check constraint invites
-- (0028_fix_products_category_constraint.sql: a hardcoded allow-list that
-- silently drifted from the tracked migration).
--
-- Existing rows all default to 'sa' -- every product in this table today
-- is South African inventory, priced and sold in ZAR.
--
-- Deliberately NOT touched here: products.price still means one thing
-- (ZAR) regardless of region, and Stripe checkout still charges ZAR only.
-- Multi-currency pricing/checkout is a separate, much larger change --
-- see the follow-up discussion before any of that lands.
-- ============================================================================

create type public.product_region as enum ('usa', 'uk', 'sa');

alter table public.products
  add column region public.product_region not null default 'sa';

-- ============================================================================
-- End of migration 0031_add_product_region.sql
-- ============================================================================
