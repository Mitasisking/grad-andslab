-- ============================================================================
-- Migration: 0023_allow_pcg_psa_ace_grading.sql
--
-- Requires 0021 and 0022 to have already been applied and committed.
--
-- Replaces 0017's chk_submissions_grading_company_pcg_only and 0019's
-- chk_submissions_tier_pcg_tiers_only with a single constraint that both
-- widens the allowed set to the three companies now offered (PCG, PSA, ACE)
-- and pins each company to its own real tiers, so a row can't pair e.g.
-- grading_company = 'PSA' with tier = 'bulk' (a PCG-only tier). As before,
-- public.grading_company/public.submission_tier themselves still technically
-- permit older values forever (Postgres enums can't drop values) -- this
-- CHECK constraint is what actually enforces it, same pattern as 0013,
-- 0017, and 0019.
-- ============================================================================

alter table public.submissions
  drop constraint if exists chk_submissions_grading_company_pcg_only;

alter table public.submissions
  drop constraint if exists chk_submissions_tier_pcg_tiers_only;

alter table public.submissions
  add constraint chk_submissions_grading_company_allowed
  check (grading_company::text in ('PCG', 'PSA', 'ACE'));

alter table public.submissions
  add constraint chk_submissions_tier_matches_company
  check (
    (grading_company::text = 'PCG' and tier::text in ('authentication', 'bulk', 'standard', 'express'))
    or (grading_company::text = 'PSA' and tier::text in ('psa_value_bulk', 'psa_regular', 'psa_express'))
    or (grading_company::text = 'ACE' and tier::text in ('ace_value', 'ace_basic', 'ace_standard'))
  );

-- ============================================================================
-- End of migration 0023_allow_pcg_psa_ace_grading.sql
-- ============================================================================
