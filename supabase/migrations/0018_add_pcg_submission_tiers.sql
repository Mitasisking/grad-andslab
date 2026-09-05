-- Migration: 0018_add_pcg_submission_tiers.sql
--
-- Replaces the placeholder economy/regular/express/super_express/
-- walk_through tiers with PCG's real four service tiers. 'express' already
-- exists in public.submission_tier; the other three are new. Restricting
-- writes to just these four happens in 0019, once these values are
-- actually committed (a newly-added enum value can't be referenced in the
-- same transaction it was added in).

alter type public.submission_tier add value if not exists 'authentication';
alter type public.submission_tier add value if not exists 'bulk';
alter type public.submission_tier add value if not exists 'standard';

-- End of migration 0018_add_pcg_submission_tiers.sql
