-- ============================================================================
-- Migration: 0055_add_product_pokemon_center.sql
--
-- Backs the Shop's "Pokémon Center" category pill and the Sealed-category
-- time-gate (app/shop/page.tsx): a product flagged is_pokemon_center is an
-- official Pokémon Center exclusive, shown under its own pill regardless of
-- its real category or age, and exempt from the Sealed time-gate the same
-- way. products.release_date already exists (0020_add_product_release_date.sql,
-- backfilled by app/api/fetch-images/route.ts and already used by
-- lib/shop/availability.ts's 3-year in-print/out-of-print split) -- nothing
-- new needed there, this migration only adds the flag.
-- ============================================================================

alter table public.products
  add column is_pokemon_center boolean not null default false;

create index idx_products_is_pokemon_center on public.products(is_pokemon_center) where is_pokemon_center;

-- ============================================================================
-- End of migration 0055_add_product_pokemon_center.sql
-- ============================================================================
