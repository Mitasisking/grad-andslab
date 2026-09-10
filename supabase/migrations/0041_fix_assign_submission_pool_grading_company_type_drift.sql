-- ============================================================================
-- Migration: 0041_fix_assign_submission_pool_grading_company_type_drift.sql
--
-- Fixes a submission-breaking bug discovered by actually running an
-- end-to-end grading-submission test (scripts/simulate-minor-test.js):
-- every attempt to create a submission failed with
--   "operator does not exist: grading_company = text"
-- from assign_submission_pool() (0035_submission_pools.sql), a BEFORE
-- INSERT trigger that fires on every single submissions row.
--
-- Root cause, confirmed against the live database via PostgREST's own
-- schema introspection (GET /rest/v1/, same technique 0040's header already
-- used): public.submissions.grading_company is actually `text` in
-- production, not the public.grading_company enum every migration file
-- back to 0001_init_schema.sql declares it as -- the same class of
-- migrations-vs-production drift 0040_fix_handle_new_user_missing_email_
-- column.sql already found on public.profiles. public.pools.grading_company
-- (0035) IS the real enum, so the trigger's
--   where grading_company = new.grading_company
-- compares an enum column against a text value with no `=` operator
-- defined between them -- and always did, for every submission, since the
-- moment 0035 was deployed.
--
-- Like 0040, this does not attempt to resolve the underlying drift (that
-- would mean altering a live, in-use production column -- a separate,
-- deliberate decision, not a side effect of unblocking submissions). This
-- migration instead makes assign_submission_pool() robust to either shape
-- (text or the real enum) by casting every grading_company/tier comparison,
-- concatenation, and insert to a known type explicitly, so it works
-- regardless of which type is actually deployed.
-- ============================================================================

create or replace function public.assign_submission_pool()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_pool_id uuid;
  v_pool_status public.pool_status;
  v_capacity integer;
  v_batch_number integer;
begin
  select id, status into v_pool_id, v_pool_status
  from public.pools
  where grading_company::text = new.grading_company::text
    and tier::text = new.tier::text
    and status = 'open'
    and current_count < capacity
  order by opened_at asc
  limit 1;

  if v_pool_id is null then
    v_capacity := case
      when new.tier::text in ('bulk', 'psa_value_bulk') then 50
      else 20
    end;

    select count(*) + 1 into v_batch_number
    from public.pools
    where grading_company::text = new.grading_company::text and tier::text = new.tier::text;

    insert into public.pools (grading_company, tier, label, capacity)
    values (
      new.grading_company::text::public.grading_company,
      new.tier::text::public.submission_tier,
      new.grading_company::text || ' ' || new.tier::text || ' Batch #' || v_batch_number,
      v_capacity
    )
    returning id, status into v_pool_id, v_pool_status;
  end if;

  new.pool_id := v_pool_id;
  new.pool_status := v_pool_status;
  return new;
end;
$$;

-- ============================================================================
-- End of migration 0041_fix_assign_submission_pool_grading_company_type_drift.sql
-- ============================================================================
