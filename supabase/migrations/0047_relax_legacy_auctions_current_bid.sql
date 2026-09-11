-- ============================================================================
-- Migration: 0047_relax_legacy_auctions_current_bid.sql
--
-- Found while actually using app/api/admin/auctions/schedule-weekly/
-- route.ts for the first time: it correctly inserts into the real column
-- set (current_high_bid, images, etc.), but the deprecated legacy column
-- current_bid -- superseded by current_high_bid as of
-- 0044_reconcile_auctions_schema.sql, deliberately left in place rather
-- than dropped -- is still `not null` with no default, so every new
-- auction insert failed with "null value in column current_bid violates
-- not-null constraint" the moment it stopped being populated.
--
-- 0044 already left highest_bidder/image_url nullable; current_bid was the
-- one legacy column still blocking inserts. This just relaxes that
-- constraint -- it does not touch the two existing legacy rows' values,
-- and does not resurrect current_bid as something new code should write.
-- ============================================================================

alter table public.auctions
  alter column current_bid drop not null;

-- ============================================================================
-- End of migration 0047_relax_legacy_auctions_current_bid.sql
-- ============================================================================
