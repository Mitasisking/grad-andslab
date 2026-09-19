-- ============================================================================
-- Migration: 0059_add_ace_flagship_premium_tiers.sql
--
-- Adds ACE Grading's new "Premier", "Ultra", and "Luxury" tiers (its
-- Flagship/Premium overhaul -- see lib/submission-types.ts
-- TIER_OPTIONS_BY_COMPANY.ACE for the label/turnaround/price each maps to).
-- The retired 'ace_value' tier is intentionally left in the enum -- Postgres
-- enums can't drop values, and existing submissions placed under it still
-- need to type- and query-check correctly.
--
-- Restricting new writes to the updated ACE tier set happens in 0060, once
-- these values are actually committed -- a newly-added enum value can't be
-- referenced in the same transaction it was added in (same split as
-- 0022/0023).
-- ============================================================================

alter type public.submission_tier add value if not exists 'ace_premier';
alter type public.submission_tier add value if not exists 'ace_ultra';
alter type public.submission_tier add value if not exists 'ace_luxury';

-- ============================================================================
-- End of migration 0059_add_ace_flagship_premium_tiers.sql
-- ============================================================================
