-- ============================================================================
-- Migration: 0054_add_product_is_auction.sql
--
-- Flags a shop product as staged for the upcoming Live Auctions feature
-- (app/auctions/page.tsx's "Coming Soon" section) instead of being sold
-- through the regular shop -- strict either/or, enforced at the query level
-- everywhere a customer can browse products (app/shop/page.tsx,
-- lib/shop/featured-products.ts), not just hidden with a client-side check.
--
-- Deliberately separate from is_active: is_active already means "hidden
-- from shop" for a different reason (not yet priced -- see
-- app/admin/shop/shop-admin-dashboard.tsx's own comments), and a product
-- can be both is_active and is_auction at once (visible on the Coming Soon
-- grid, not visible in the regular shop).
-- ============================================================================

alter table public.products
  add column is_auction boolean not null default false;

create index idx_products_is_auction on public.products(is_auction) where is_auction;

-- ============================================================================
-- End of migration 0054_add_product_is_auction.sql
-- ============================================================================
