-- ============================================================================
-- Migration: 0022_add_psa_ace_submission_tiers.sql
--
-- Adds PSA's and ACE Grading's real service tiers, prefixed by company so a
-- tier value alone is unambiguous (PCG's own four tiers, added in 0018, are
-- unprefixed since they were first and there was nothing yet to disambiguate
-- from -- see lib/submission-types.ts TIER_OPTIONS_BY_COMPANY for the
-- label/price each of these maps to, all in USD).
--
-- Requires 0021 (adds the 'ACE' grading_company enum value) to have already
-- been applied and committed. Restricting writes to just these plus PCG's
-- four happens in 0023, once these values are actually committed -- a
-- newly-added enum value can't be referenced in the same transaction it was
-- added in.
-- ============================================================================

alter type public.submission_tier add value if not exists 'psa_value_bulk';
alter type public.submission_tier add value if not exists 'psa_regular';
alter type public.submission_tier add value if not exists 'psa_express';
alter type public.submission_tier add value if not exists 'ace_value';
alter type public.submission_tier add value if not exists 'ace_basic';
alter type public.submission_tier add value if not exists 'ace_standard';

-- ============================================================================
-- End of migration 0022_add_psa_ace_submission_tiers.sql
-- ============================================================================
