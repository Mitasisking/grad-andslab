-- ============================================================================
-- 0068_per_card_add_ons.sql
--
-- Moves the grading submission add-ons from the submission to each card
-- (components/submit/step-addons.tsx):
--   * cleaning_tier       -- 'none' (R0) | 'half' (R200) | 'full' (R500)
--   * requires_slab_guard -- R110 Slab Guard bumper for that card's slab
-- Prices live in lib/submission-types.ts (CLEANING_TIER_OPTIONS,
-- SLAB_GUARD_FEE_ZAR), all ZAR.
--
-- Stored per item because the price is server-authoritative:
-- lib/submission-pricing.ts recomputes every total from the stored
-- submission + submission_items rows at checkout, in the Payfast ITN webhook
-- and in the confirmation email, so every priced option has to be a column.
--
-- The old submission-level columns (submissions.needs_clean_and_polish,
-- submissions.requires_slab_guard) are NOT dropped: new submissions store
-- false there, and pre-rework submissions keep their original flat-fee
-- pricing through them. submission_items.pre_check_opt_in is kept too and
-- written as (cleaning_tier <> 'none') by /api/submissions, for readers that
-- predate this migration.
--
-- Backfill: a pre-rework card with pre_check_opt_in = true was charged the
-- R200 per-card prep fee, which is exactly 'half' -- unless its submission
-- had the submission-wide Clean & Polish, which overrode (and zeroed) the
-- per-card prep. Those stay 'none' and keep pricing via
-- submissions.needs_clean_and_polish.
--
-- MUST be applied before the app code that reads/writes these columns is
-- deployed: the checkout route and webhook select both columns, and
-- /api/submissions inserts them.
-- ============================================================================

alter table public.submission_items
  add column if not exists cleaning_tier text not null default 'none',
  add column if not exists requires_slab_guard boolean not null default false;

alter table public.submission_items
  drop constraint if exists chk_submission_items_cleaning_tier;
alter table public.submission_items
  add constraint chk_submission_items_cleaning_tier
  check (cleaning_tier in ('none', 'half', 'full'));

comment on column public.submission_items.cleaning_tier is
  'Per-card pre-grading clean: none (R0), half (R200) or full (R500) -- see lib/submission-types.ts CLEANING_TIER_OPTIONS.';
comment on column public.submission_items.requires_slab_guard is
  'Customer opted into the R110 Slab Guard bumper for this card (see lib/submission-types.ts SLAB_GUARD_FEE_ZAR).';

update public.submission_items i
set cleaning_tier = 'half'
from public.submissions s
where s.id = i.submission_id
  and i.pre_check_opt_in = true
  and s.needs_clean_and_polish = false
  and i.cleaning_tier = 'none';

-- ============================================================================
-- End of migration 0068_per_card_add_ons.sql
-- ============================================================================
