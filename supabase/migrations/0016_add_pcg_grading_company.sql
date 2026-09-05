-- Migration: 0016_add_pcg_grading_company.sql
--
-- The business exclusively grades through Premier Card Grading (PCG), but
-- public.grading_company (0001_init_schema.sql) only had 'PSA', 'CGC',
-- 'BGS' -- no application code should ever write those going forward
-- (enforced in 0017, split into its own migration since a newly-added enum
-- value can't be used in the same transaction it was added in).

alter type public.grading_company add value if not exists 'PCG';

-- End of migration 0016_add_pcg_grading_company.sql
