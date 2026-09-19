-- ============================================================================
-- Migration: 0060_allow_ace_flagship_premium_tiers.sql
--
-- Requires 0059 to have already been applied and committed.
--
-- Widens chk_submissions_tier_matches_company (added in 0023) so new ACE
-- submissions can use the Flagship/Premium tier set ('ace_basic',
-- 'ace_standard', 'ace_premier', 'ace_ultra', 'ace_luxury'). 'ace_value' is
-- deliberately kept in the allowed list here too -- dropping it from this
-- CHECK constraint would require validating it against every existing row,
-- and the application layer (TIER_OPTIONS_BY_COMPANY.ACE in
-- lib/submission-types.ts) already stopped offering it, which is what
-- actually prevents new submissions from using it. PCG and PSA's allowed
-- tiers are unchanged.
-- ============================================================================

alter table public.submissions
  drop constraint if exists chk_submissions_tier_matches_company;

alter table public.submissions
  add constraint chk_submissions_tier_matches_company
  check (
    (grading_company::text = 'PCG' and tier::text in ('authentication', 'bulk', 'standard', 'express'))
    or (grading_company::text = 'PSA' and tier::text in ('psa_value_bulk', 'psa_regular', 'psa_express'))
    or (grading_company::text = 'ACE' and tier::text in ('ace_value', 'ace_basic', 'ace_standard', 'ace_premier', 'ace_ultra', 'ace_luxury'))
  );

-- ============================================================================
-- End of migration 0060_allow_ace_flagship_premium_tiers.sql
-- ============================================================================
