-- ============================================================================
-- Migration: 0042_enforce_addon_mutual_exclusion.sql
--
-- Closes a billing-integrity gap re-confirmed by MAJOR SYSTEMS TEST 2
-- (scripts/simulate-major-test-2.js / scripts/.major-test-2-manifest.json):
-- public.submissions.needs_clean_and_polish (the flat R500 bulk "Clean and
-- Polish" add-on, 0035_submission_pools.sql) and
-- public.submission_items.pre_check_opt_in (the per-card "pre-grading
-- preparation" flag, 0001_init_schema.sql) are only prevented from both
-- being true by client-side logic in components/submit/step-addons.tsx
-- (handleToggleCleanAndPolish / handleTogglePerCardPrep) -- nothing in the
-- database stops it. The test proved this directly: it inserted a
-- submission with needs_clean_and_polish = true and a sibling
-- submission_items row with pre_check_opt_in = true and both persisted with
-- no error, recorded as findings.addOnConflictPersisted: true (and
-- mixedAddOnConflictPersisted: true on the run's profiles n=14/15/16).
-- Left alone this lets a customer be billed for both the bulk service and
-- the per-card service on the same card, which are supposed to be
-- either/or per the submit flow's own copy ("replaces per-card preparation
-- below, so both are never charged together").
--
-- Schema check performed before writing this migration, per this repo's
-- standing mandate to confirm column shape against the live database rather
-- than trust the migration files (GET {SUPABASE_URL}/rest/v1/ with the
-- service-role key, same technique 0040/0041 used): both columns ARE
-- boolean in production, matching what 0001/0035 declare --
-- definitions.submissions.properties.needs_clean_and_polish and
-- definitions.submission_items.properties.pre_check_opt_in both report
-- {"type":"boolean","format":"boolean"}. No type drift here, unlike
-- grading_company (0041) or profiles (0040) -- this migration is purely
-- about the missing cross-table constraint, not a drift fix.
--
-- Why a trigger instead of a CHECK constraint: chk_submissions_tier_matches_
-- company (0023) and chk_submission_items_sport_matches_card_type (0025)
-- are same-table CHECKs, which Postgres can evaluate against a single row.
-- This rule spans two tables in a one-to-many relationship (one
-- submissions row, many submission_items rows), which a CHECK constraint
-- fundamentally cannot see across -- a Postgres CHECK may only reference
-- columns of the row being written. A trigger is the only mechanism that
-- can look at the sibling table's current data at write time, so this adds
-- a BEFORE INSERT OR UPDATE trigger on each table:
--   * on submission_items, when a row's own pre_check_opt_in is (or is
--     being set to) true, checks its parent submissions row;
--   * on submissions, when needs_clean_and_polish is (or is being set to)
--     true, checks every existing sibling submission_items row.
-- Both directions are covered because either flag could in principle be
-- the one written second (today's only write path, app/api/submissions/
-- route.ts, always inserts the submissions row first and the
-- submission_items rows after in the same request, so in practice only the
-- submission_items-side trigger fires on the normal happy path -- the
-- submissions-side trigger exists so a future direct UPDATE of
-- needs_clean_and_polish, e.g. from an admin tool, can't silently
-- re-introduce the same conflict against items that already opted in).
--
-- security definer set search_path = public: this function only reads the
-- sibling table to evaluate the rule and never returns that data to the
-- caller (it either allows the write or raises), so there's no
-- confidentiality concern in bypassing RLS for the read -- and it needs to,
-- since the customer's own session (app/api/submissions/route.ts uses the
-- route-scoped client, not the service role) must reliably see its own
-- just-inserted submissions row and/or existing submission_items rows for
-- this check to be trustworthy regardless of how RLS on those tables
-- evolves later. Unlike create_order()/post_submission_ledger_entries()/
-- assign_submission_pool(), this function performs no write and grants no
-- elevated access to anything beyond this one boolean check, so it doesn't
-- need its own auth.uid() ownership check -- it can only make an
-- already-permitted write fail, never allow one that RLS would otherwise
-- reject.
-- ============================================================================

create or replace function public.enforce_addon_mutual_exclusion()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_submission_needs_clean_and_polish boolean;
  v_conflicting_item_exists boolean;
begin
  if tg_table_name = 'submission_items' then
    if coalesce(new.pre_check_opt_in, false) then
      select needs_clean_and_polish
      into v_submission_needs_clean_and_polish
      from public.submissions
      where id = new.submission_id;

      if coalesce(v_submission_needs_clean_and_polish, false) then
        raise exception
          'submission_items.pre_check_opt_in cannot be true for submission % because that submission already has needs_clean_and_polish = true -- the bulk Clean and Polish add-on and per-card pre-grading preparation are mutually exclusive',
          new.submission_id
          using errcode = '23514';
      end if;
    end if;
    return new;
  end if;

  if tg_table_name = 'submissions' then
    if coalesce(new.needs_clean_and_polish, false) then
      select exists (
        select 1
        from public.submission_items
        where submission_id = new.id
          and pre_check_opt_in = true
      )
      into v_conflicting_item_exists;

      if v_conflicting_item_exists then
        raise exception
          'submissions.needs_clean_and_polish cannot be set to true for submission % because one or more of its submission_items already has pre_check_opt_in = true -- the bulk Clean and Polish add-on and per-card pre-grading preparation are mutually exclusive',
          new.id
          using errcode = '23514';
      end if;
    end if;
    return new;
  end if;

  return new;
end;
$$;

create trigger trg_submission_items_check_addon_conflict
  before insert or update of pre_check_opt_in, submission_id on public.submission_items
  for each row execute function public.enforce_addon_mutual_exclusion();

create trigger trg_submissions_check_addon_conflict
  before insert or update of needs_clean_and_polish on public.submissions
  for each row execute function public.enforce_addon_mutual_exclusion();

-- ============================================================================
-- End of migration 0042_enforce_addon_mutual_exclusion.sql
-- ============================================================================
