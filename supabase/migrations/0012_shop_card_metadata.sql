-- ============================================================================
-- Migration: 0012_shop_card_metadata.sql
-- Adds what app/api/fetch-images/route.ts needs to look up TCGdex artwork:
-- neither the set name nor the card's local number had a column before this
-- (0001_init_schema.sql's products table only ever expected a title/
-- description/category/price/stock), and individual raw cards (as opposed
-- to sealed product, accessories, or graded slabs) weren't a category at
-- all yet.
--
-- Whatever process populates `products` from the Collectr export.csv (not
-- built here) needs to start writing set_name (CSV "Set") and card_number
-- (CSV "Card Number", e.g. "077/066") on every row going forward, and
-- category = 'cards' for raw/ungraded singles specifically.
-- ============================================================================

alter type public.product_category add value if not exists 'cards';

alter table public.products
  add column if not exists set_name text,
  add column if not exists card_number text;

-- ============================================================================
-- End of migration 0012_shop_card_metadata.sql
-- ============================================================================
