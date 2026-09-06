-- ============================================================================
-- Migration: 0021_add_ace_grading_company.sql
--
-- Adds PSA and ACE Grading alongside the existing PCG integration (business
-- decision, not a revert of 0017 -- that migration's "three-grader picker"
-- bug was offering PSA/CGC/BGS with no real backing integration; this is a
-- deliberate addition of two real partners with their own priced tiers, see
-- 0022 and 0023). public.grading_company (0001_init_schema.sql) already has
-- 'PSA' from its original enum; only 'ACE' is new here. Split into its own
-- migration since a newly-added enum value can't be used in the same
-- transaction it was added in.
-- ============================================================================

alter type public.grading_company add value if not exists 'ACE';

-- ============================================================================
-- End of migration 0021_add_ace_grading_company.sql
-- ============================================================================
