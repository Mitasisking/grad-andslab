-- ============================================================================
-- Migration: 0035_submission_pools.sql
-- Adds the "Clean and Polish" R500 pre-grading add-on and a batch/pool
-- concept for grading submissions -- until now nothing grouped submissions
-- into a shippable batch, so there was no way to show "PSA Bulk 35/50"
-- anywhere. This adds public.pools (one row per open/closed/shipped batch,
-- keyed by grading_company + tier) plus submissions.pool_id/pool_status,
-- and wires up triggers so pool membership, live counts, and auto-close-at-
-- capacity all happen automatically on submission insert -- callers
-- (app/api/submissions/route.ts) don't need to know pools exist.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. needs_clean_and_polish -- flat R500 add-on selected in the submit flow's
--    add-ons step (components/submit/step-addons.tsx), distinct from the
--    existing free pre_check_opt_in inspection on submission_items.
-- ----------------------------------------------------------------------------
alter table public.submissions
  add column needs_clean_and_polish boolean not null default false;

-- ----------------------------------------------------------------------------
-- 2. pool_status -- lifecycle of the BATCH a submission belongs to. Kept as
--    its own enum (rather than reusing submission_status, which tracks the
--    individual submission's own physical journey) since a submission can be
--    'received' while its pool is still 'open', and the two must be able to
--    diverge.
-- ----------------------------------------------------------------------------
create type public.pool_status as enum ('open', 'closed', 'shipped', 'completed');

create table public.pools (
  id             uuid primary key default gen_random_uuid(),
  grading_company public.grading_company not null,
  tier           public.submission_tier not null,
  label          text not null,
  capacity       integer not null default 50 check (capacity > 0),
  current_count  integer not null default 0 check (current_count >= 0),
  status         public.pool_status not null default 'open',
  opened_at      timestamptz not null default now(),
  closed_at      timestamptz,
  shipped_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index idx_pools_status on public.pools(status);
create index idx_pools_company_tier on public.pools(grading_company, tier);

create trigger trg_pools_updated_at
  before update on public.pools
  for each row execute function public.set_updated_at();

alter table public.submissions
  add column pool_id uuid references public.pools(id) on delete set null,
  add column pool_status public.pool_status;

create index idx_submissions_pool_id on public.submissions(pool_id);

-- ----------------------------------------------------------------------------
-- 3. Auto-assignment -- every new submission is dropped into the current
--    open pool for its (grading_company, tier), or a fresh one is opened if
--    none exists / the current one is full. security definer because the
--    inserting session is the customer's own (app/api/submissions/route.ts
--    uses the route-scoped client, not the service role), and pools' RLS
--    below is admin-write-only -- this function is the one sanctioned way a
--    non-admin session can affect a pools row.
--
--    Capacity: bulk-style tiers genuinely require 50+ cards per the tier
--    definitions themselves (lib/submission-types.ts's "Minimum 50+ cards"
--    note on PCG 'bulk' and PSA 'psa_value_bulk') so those batches target
--    50; every other tier defaults to a smaller 20-submission batch so
--    "pool progress" is still meaningful for non-bulk tiers instead of
--    sitting open indefinitely.
-- ----------------------------------------------------------------------------
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
  where grading_company = new.grading_company
    and tier = new.tier
    and status = 'open'
    and current_count < capacity
  order by opened_at asc
  limit 1;

  if v_pool_id is null then
    v_capacity := case
      when new.tier in ('bulk', 'psa_value_bulk') then 50
      else 20
    end;

    select count(*) + 1 into v_batch_number
    from public.pools
    where grading_company = new.grading_company and tier = new.tier;

    insert into public.pools (grading_company, tier, label, capacity)
    values (
      new.grading_company,
      new.tier,
      new.grading_company || ' ' || new.tier || ' Batch #' || v_batch_number,
      v_capacity
    )
    returning id, status into v_pool_id, v_pool_status;
  end if;

  new.pool_id := v_pool_id;
  new.pool_status := v_pool_status;
  return new;
end;
$$;

create trigger trg_submissions_assign_pool
  before insert on public.submissions
  for each row execute function public.assign_submission_pool();

-- ----------------------------------------------------------------------------
-- 4. Count bookkeeping -- runs after the row (and its pool_id) exists, so it
--    only ever increments/decrements; auto-closes a pool the moment it hits
--    capacity so the next submission's assignment above opens a new batch.
-- ----------------------------------------------------------------------------
create or replace function public.sync_pool_count_on_insert()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.pools
  set current_count = current_count + 1
  where id = new.pool_id;

  update public.pools
  set status = 'closed', closed_at = now()
  where id = new.pool_id and current_count >= capacity and status = 'open';

  return new;
end;
$$;

create trigger trg_submissions_sync_pool_count
  after insert on public.submissions
  for each row execute function public.sync_pool_count_on_insert();

-- ----------------------------------------------------------------------------
-- 5. Cascade -- when an admin advances a pool (closed -> shipped ->
--    completed) from /admin/pools, reflect that on every member submission's
--    pool_status without the admin UI having to update both.
-- ----------------------------------------------------------------------------
create or replace function public.cascade_pool_status()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    update public.submissions set pool_status = new.status where pool_id = new.id;
  end if;
  return new;
end;
$$;

create trigger trg_pools_cascade_status
  after update of status on public.pools
  for each row execute function public.cascade_pool_status();

-- ----------------------------------------------------------------------------
-- 6. RLS -- pools carry no customer PII (just company/tier/counts), so
--    they're readable by anyone for the public PoolTracker sidebar. Writes
--    are admin-only from the client; the triggers above bypass RLS via
--    security definer for the customer-driven insert/count-sync path.
-- ----------------------------------------------------------------------------
alter table public.pools enable row level security;

create policy "pools_select_all"
  on public.pools for select
  using (true);

create policy "pools_update_admin_only"
  on public.pools for update
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================================
-- End of migration 0035_submission_pools.sql
-- ============================================================================
