-- ============================================================================
-- 0069_per_card_label_option.sql
--
-- Moves ACE Grading's label option (Standard R0 / Colour Match R25 / Ace
-- Label R75 -- lib/submission-types.ts ACE_LABEL_OPTIONS, ZAR only) from the
-- submission to each card, alongside 0068's per-card cleaning_tier and
-- requires_slab_guard (components/submit/step-addons.tsx).
--
-- Stored per item because the price is server-authoritative:
-- lib/submission-pricing.ts recomputes every total from the stored rows at
-- checkout, in the Payfast ITN webhook and in the confirmation email.
--
-- Backfill: every existing item inherits its submission's
-- submissions.ace_label_option (0061), so pre-rework submissions keep
-- pricing exactly as charged -- the old per-submission label applied to
-- every card, which is what this copies. A null there (non-ACE, or placed
-- before 0061) stays 'standard' (free), which is also how it was priced.
-- submissions.ace_label_option is kept for history; new submissions store
-- null there (0061's CHECK allows that for any company).
--
-- The label is only charged for grading_company = 'ACE' (enforced in
-- lib/submission-pricing.ts), so no cross-table CHECK is needed here: a
-- non-ACE item is always priced as Standard whatever this column holds.
--
-- MUST be applied before the app code that reads/writes this column is
-- deployed: the checkout route and webhook select it, and /api/submissions
-- inserts it.
-- ============================================================================

alter table public.submission_items
  add column if not exists ace_label_option text not null default 'standard';

alter table public.submission_items
  drop constraint if exists chk_submission_items_ace_label_option;
alter table public.submission_items
  add constraint chk_submission_items_ace_label_option
  check (ace_label_option in ('standard', 'colour_match', 'ace_label'));

comment on column public.submission_items.ace_label_option is
  'Per-card ACE label: standard (R0), colour_match (R25) or ace_label (R75) -- see lib/submission-types.ts ACE_LABEL_OPTIONS. Only charged for ACE submissions.';

update public.submission_items i
set ace_label_option = s.ace_label_option
from public.submissions s
where s.id = i.submission_id
  and s.ace_label_option is not null
  and i.ace_label_option = 'standard';

-- ============================================================================
-- End of migration 0069_per_card_label_option.sql
-- ============================================================================
