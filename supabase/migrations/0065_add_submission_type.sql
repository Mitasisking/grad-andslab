-- ============================================================================
-- Migration: 0065_add_submission_type.sql
--
-- Adds the customer's choice of international dispatch method for a
-- submission: 'batch' (consolidated into our upcoming scheduled shipment,
-- sharing freight/customs costs) or 'individual' (a standalone dedicated
-- shipment, dispatched as soon as the cards arrive at HQ). Surfaced in
-- Step 1 of /submit (components/submit/step-grader-tier.tsx's new
-- "Submission Method" section) and priced in Step 3
-- (components/submit/step-review-pay.tsx's international shipping line
-- item).
--
-- This is deliberately NOT the same concept as pool_id/pool_status
-- (0035_submission_pools.sql) -- those track membership in a specific,
-- real public.pools row (a tier-scoped batch with capacity, opened via the
-- currently-hidden LiveBatchTracker UI, SHOW_BATCH_TRACKER = false in
-- app/submit/page.tsx). submission_type is a much simpler standing customer
-- preference ("I'm fine sharing a batch" vs "I want mine dispatched alone")
-- that exists independently of whether a real pool is currently open to
-- join -- a 'batch' submission_type does not require or imply a non-null
-- pool_id.
--
-- Plain text + CHECK, not a new enum, same reasoning as
-- 0061_add_ace_label_option.sql's ace_label_option: no cross-table type
-- safety is needed here, and a CHECK constraint can be altered in one
-- statement.
--
-- Defaults every existing row to 'batch' -- the cheaper, previously-implicit
-- default behavior before this column existed, so no historical submission
-- is silently reclassified as needing (and having skipped paying for) a
-- dedicated individual dispatch.
-- ============================================================================

alter table public.submissions
  add column submission_type text not null default 'batch';

alter table public.submissions
  add constraint chk_submissions_submission_type_valid
  check (submission_type in ('batch', 'individual'));

-- ============================================================================
-- End of migration 0065_add_submission_type.sql
-- ============================================================================
