-- ============================================================================
-- Migration: 0033_add_submission_region.sql
--
-- Adds public.submissions.region so the /submit wizard's new "Country of
-- Origin" step (components/submit/step-grader-tier.tsx) can record which
-- region a submission's grading fee/shipping was priced and charged in.
-- Reuses public.product_region (0031_add_product_region.sql) rather than a
-- second enum -- same three values (usa/uk/sa), same meaning: which
-- currency this row's money figures are denominated in, no conversion.
--
-- Existing rows default to 'usa', NOT the shop's 'sa' default -- every
-- submission taken before this column existed went through the old
-- USD-only flow (lib/currency.ts's formatUSD, app/api/submissions/
-- checkout/route.ts's hardcoded currency: 'usd'), so 'usa' is what actually
-- happened to those rows, not an arbitrary default.
-- ============================================================================

alter table public.submissions
  add column region public.product_region not null default 'usa';

-- ============================================================================
-- End of migration 0033_add_submission_region.sql
-- ============================================================================
