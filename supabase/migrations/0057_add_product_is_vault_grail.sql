-- ============================================================================
-- Migration: 0057_add_product_is_vault_grail.sql
--
-- Manual curation flag for "The Cuppa's Cards Vault" homepage carousel
-- (components/FeaturedCarousel.tsx, fed by lib/shop/featured-products.ts) --
-- that carousel previously auto-selected the region's 7 highest-priced
-- in-stock listings; it now strictly shows admin-curated grails instead, so
-- a single expensive but visually uninteresting listing can't dominate it
-- and a deliberately-chosen showpiece can be featured regardless of price.
-- ============================================================================

alter table public.products
  add column is_vault_grail boolean not null default false;

create index idx_products_is_vault_grail on public.products(is_vault_grail) where is_vault_grail;

-- ============================================================================
-- End of migration 0057_add_product_is_vault_grail.sql
-- ============================================================================
