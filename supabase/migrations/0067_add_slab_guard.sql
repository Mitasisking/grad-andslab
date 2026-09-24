-- ============================================================================
-- 0067_add_slab_guard.sql
--
-- Optional "Slab Guard" add-on for grading submissions: a premium
-- protective bumper fitted to the returned graded slab, a flat R95 per
-- submission (lib/submission-types.ts's SLAB_GUARD_FEE_ZAR).
--
-- Stored on the submission because the price is server-authoritative:
-- lib/submission-pricing.ts recomputes every total from the stored
-- submission + submission_items rows at checkout and in the Payfast ITN
-- webhook, so every priced option has to be a column.
--
-- MUST be applied before the app code that reads/writes this column is
-- deployed: the checkout route and webhook select requires_slab_guard, and
-- /api/submissions inserts it.
-- ============================================================================

alter table public.submissions
  add column if not exists requires_slab_guard boolean not null default false;

comment on column public.submissions.requires_slab_guard is
  'Customer opted into the flat R95 Slab Guard bumper for their returned slab (see lib/submission-types.ts SLAB_GUARD_FEE_ZAR).';

-- ============================================================================
-- End of migration 0067_add_slab_guard.sql
-- ============================================================================
