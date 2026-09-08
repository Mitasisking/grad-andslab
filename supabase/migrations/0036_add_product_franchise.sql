-- ============================================================================
-- Migration: 0036_add_product_franchise.sql
-- Adds a broad "franchise" facet to products (Pokemon / Sports / General)
-- for the /admin/shop inventory table's new Franchise + Category filters
-- (app/admin/shop/shop-admin-dashboard.tsx), and backfills existing rows by
-- title keyword so hundreds of existing products don't need manual
-- reclassification through the admin form.
--
-- Deliberately a NEW column, not a repurposing of the existing card_type
-- column (0026_add_shop_sports_card_products.sql): card_type is narrowly
-- scoped to actual cards (paired with a required `sport` via
-- chk_products_sport_matches_card_type, and meaningless for e.g. an
-- accessories or sealed-product row), whereas franchise is meant to apply
-- across every category, sealed and accessories included -- a Pokemon
-- booster box and a generic screwdriver-shaped card-grading tool are both
-- 'sealed' or 'accessories', but only one of them is Pokemon-branded.
-- Overloading card_type for that would either violate its own sport-pairing
-- constraint or require weakening it.
--
-- Enum values stay lowercase snake-case ('pokemon' / 'sports' / 'general'),
-- matching every other enum in this schema (card_type, product_category,
-- etc.) -- the admin UI is what renders these as "Pokémon" / "Sports" /
-- "General", the same split already used for e.g. product_category's
-- 'cards' rendering as "Raw Cards" (components/shop/category-tabs.tsx).
--
-- Backfill is keyword-based off title, in the order given: Sports-brand
-- keywords first, then named Pokemon set keywords, and everything neither
-- matches keeps the column default of 'general' -- no separate fallback
-- UPDATE is needed for that since it's just what every row already is
-- before either targeted UPDATE below runs. Sports keywords are checked
-- first so a title matching both a sports brand and (implausibly) a
-- Pokemon set keyword resolves to Sports, per the order specified.
-- ============================================================================

create type public.product_franchise as enum ('pokemon', 'sports', 'general');

alter table public.products
  add column franchise public.product_franchise not null default 'general';

update public.products
set franchise = 'sports'
where title ilike '%Topps%'
   or title ilike '%Panini%'
   or title ilike '%Bowman%'
   or title ilike '%Prizm%'
   or title ilike '%Optic%'
   or title ilike '%Select%'
   or title ilike '%Contenders%';

update public.products
set franchise = 'pokemon'
where franchise = 'general'
  and (
       title ilike '%Surging Sparks%'
    or title ilike '%Team Up%'
    or title ilike '%Paradise Dragona%'
    or title ilike '%Mask of Change%'
    or title ilike '%Mega Symphonia%'
    or title ilike '%Inferno X%'
    or title ilike '%Battle Partners%'
    or title ilike '%Heat Wave Arena%'
    or title ilike '%Black Bolt%'
    or title ilike '%White Flare%'
    or title ilike '%Phantasmal Flames%'
  );

create index idx_products_franchise on public.products(franchise);

-- ============================================================================
-- End of migration 0036_add_product_franchise.sql
-- ============================================================================
