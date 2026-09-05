-- ============================================================================
-- Migration: 0020_add_product_release_date.sql
-- Adds products.release_date, backfilled by app/api/fetch-images/route.ts
-- from TCGdex's set-detail `releaseDate` field. Needed so the Shop UI can
-- split "Sealed" into In Print / Out of Print -- a sealed product is out of
-- print once 3+ years have passed since its set's release_date, computed
-- at request time in lib/shop/availability.ts rather than stored as a flag,
-- so nothing needs to change here as products age across that threshold.
-- ============================================================================

alter table public.products
  add column if not exists release_date date;

-- ============================================================================
-- End of migration 0020_add_product_release_date.sql
-- ============================================================================
