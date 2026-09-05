-- Migration: 0019_restrict_submission_tier_to_pcg_tiers.sql
--
-- Requires 0018 to have already been applied and committed.
--
-- Relabels any existing submission on an old placeholder tier to
-- 'standard' (the closest real PCG equivalent to the old default,
-- 'regular'), points the column's own default at it, then blocks the app
-- from ever writing economy/regular/super_express/walk_through again --
-- public.submission_tier itself still technically permits them forever
-- (Postgres enums can't drop values), so this CHECK constraint is what
-- actually enforces it, same pattern as 0013 and 0017.

update public.submissions
  set tier = 'standard'
  where tier::text not in ('authentication', 'bulk', 'standard', 'express');

alter table public.submissions alter column tier set default 'standard';

alter table public.submissions
  add constraint chk_submissions_tier_pcg_tiers_only
  check (tier::text in ('authentication', 'bulk', 'standard', 'express'));

-- End of migration 0019_restrict_submission_tier_to_pcg_tiers.sql
