-- ============================================================================
-- Migration: 0061_add_ace_label_option.sql
--
-- Adds ACE Grading's label options (Standard/Colour Match/Ace Label -- see
-- lib/submission-types.ts's AceLabelOption/ACE_LABEL_OPTIONS) as a
-- per-submission choice, same modeling as the existing flat
-- needs_clean_and_polish/needs_semi_rigids/interested_in_consignment
-- columns (0039_add_semi_rigids_and_consignment_flags.sql): one choice
-- applies to every card in the batch, not stored per submission_item.
--
-- Plain text + CHECK rather than a new Postgres enum, since this doesn't
-- need cross-table type safety the way grading_company/submission_tier do,
-- and a CHECK constraint can be altered in a single statement (no
-- add-then-separately-commit dance an enum would need).
--
-- The constraint allows NULL regardless of grading_company (never
-- retroactively invalidates the historical rows created before this column
-- existed, ACE or otherwise) and only lets grading_company = 'ACE' rows set
-- a non-null value -- a non-ACE submission can never have a label option.
-- ============================================================================

alter table public.submissions
  add column ace_label_option text;

alter table public.submissions
  add constraint chk_submissions_ace_label_option_valid
  check (
    ace_label_option is null
    or (grading_company::text = 'ACE' and ace_label_option in ('standard', 'colour_match', 'ace_label'))
  );

-- ============================================================================
-- End of migration 0061_add_ace_label_option.sql
-- ============================================================================
