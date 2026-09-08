-- ============================================================================
-- Migration: 0037_backfill_product_franchise_from_card_type.sql
-- Follow-up to 0036_add_product_franchise.sql's title-keyword backfill,
-- which only matched 2 Pokemon products in production -- the given keyword
-- list (11 named sets) was never meant to be exhaustive, and it turns out
-- product titles don't even embed the set name; that lives in the separate
-- set_name column instead (e.g. a row titled "Booster Box" with
-- set_name = 'Mega Symphonia').
--
-- Rather than keep expanding a title-keyword list that will always lag
-- behind the catalog (queried production directly: 41+ distinct set_name
-- values just among still-'general' rows), this uses a signal that's
-- already on every row and doesn't need maintenance: card_type. It's set
-- for every product (defaults to 'pokemon' -- 0026_add_shop_sports_card_products.sql),
-- so on its own it's not trustworthy for rows with no other information,
-- but combined with set_name actually being populated (meaning someone
-- deliberately catalogued this as a real card, via the Collectr import or
-- the admin form's Set/Brand-set field), it's a solid signal:
--   - card_type = 'sports_card' rows in 'general' are sports products the
--     0036 title-keyword pass missed (titles without a brand name in
--     them) -- reclassify to 'sports'.
--   - card_type = 'pokemon' rows in 'general' WITH a set_name are real
--     Pokemon cards/sealed product -- reclassify to 'pokemon'.
-- Rows with no set_name at all (no signal either way) stay 'general'.
-- ============================================================================

update public.products
set franchise = 'sports'
where franchise = 'general'
  and card_type = 'sports_card';

update public.products
set franchise = 'pokemon'
where franchise = 'general'
  and card_type = 'pokemon'
  and set_name is not null;

-- ============================================================================
-- End of migration 0037_backfill_product_franchise_from_card_type.sql
-- ============================================================================
