-- ============================================================================
-- Migration: 0039_add_semi_rigids_and_consignment_flags.sql
-- Two new whole-submission Yes/No flags for the redesigned Add-ons step
-- (components/submit/step-addons.tsx): whether semi-rigids should be added
-- to the order, and whether the customer is interested in consigning their
-- cards once they return from grading. Both informational -- no fee is
-- attached to either, unlike needs_clean_and_polish
-- (0035_submission_pools.sql) or submission_items.pre_check_opt_in.
-- ============================================================================

alter table public.submissions
  add column needs_semi_rigids boolean not null default false,
  add column interested_in_consignment boolean not null default false;

-- ============================================================================
-- End of migration 0039_add_semi_rigids_and_consignment_flags.sql
-- ============================================================================
