-- Migration: 0017_restrict_grading_company_to_pcg.sql
--
-- Requires 0016 (adds the 'PCG' enum value) to have already been applied
-- and committed -- a newly-added enum value can't be referenced in the same
-- transaction it was added in.
--
-- Any existing submission recorded against 'PSA'/'CGC'/'BGS' is relabeled to
-- 'PCG' first (the business has only ever graded through PCG; those values
-- could only exist from the app's own now-fixed bug of offering a
-- three-grader picker it should never have had). public.grading_company
-- itself still technically permits 'PSA'/'CGC'/'BGS' forever -- Postgres has
-- no DROP VALUE for enums -- so this CHECK constraint is what actually
-- blocks the app from writing them again, the same pattern
-- 0013_standardize_product_category.sql used for products.category.

update public.submissions set grading_company = 'PCG' where grading_company::text != 'PCG';

alter table public.submissions
  add constraint chk_submissions_grading_company_pcg_only
  check (grading_company::text = 'PCG');

-- End of migration 0017_restrict_grading_company_to_pcg.sql
