-- ============================================================================
-- Migration: 0046_staggered_weekly_auctions.sql
--
-- Backs the staggered "Live Auctions" weekly program: every auction in it
-- runs exactly 28 days, queued 7 days apart, so exactly one ends every
-- Friday at 19:00 SAST (17:00 UTC -- South Africa has no daylight saving,
-- so this offset never drifts across the year). At steady state that's 4
-- overlapping auctions, each a week apart in both start and end.
--
-- public.auctions is a general multi-seller marketplace table (any
-- customer's graded card can be listed via app/api/auctions/route.ts) --
-- this migration deliberately does NOT change that. It adds a way to mark
-- which auctions are part of the curated weekly program specifically, and
-- a time-gated visibility rule so a queued future auction simply isn't
-- publicly visible until its own starts_at arrives -- no separate
-- "publish" action needed, and nothing to get out of sync if one is ever
-- missed.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Mark which auctions belong to the curated weekly program.
-- ----------------------------------------------------------------------------
alter table public.auctions
  add column if not exists is_weekly_feature boolean not null default false;

create index if not exists idx_auctions_weekly_feature on public.auctions(is_weekly_feature) where is_weekly_feature;

-- ----------------------------------------------------------------------------
-- 2. Public visibility should never include an auction before its own
--    starts_at -- true for every auction, not just weekly-feature ones.
--    auctions_select_public (0044_reconcile_auctions_schema.sql) had no
--    time gate at all, so a future-dated auction was already just as
--    publicly visible as a live one. This is what lets the weekly pipeline
--    queue auctions ahead of time and have each one appear automatically,
--    exactly on schedule.
-- ----------------------------------------------------------------------------
drop policy if exists "auctions_select_public" on public.auctions;
create policy "auctions_select_public"
  on public.auctions for select
  using (starts_at <= now() or auth.uid() = seller_id or public.is_admin());

-- ----------------------------------------------------------------------------
-- 3. next_friday_1900_utc: the next Friday 19:00 SAST (17:00 UTC) strictly
--    after a given timestamp. Built from generate_series + a day-of-week
--    filter rather than manual date arithmetic (date_trunc('week', ...) +
--    offset math is easy to get subtly wrong around week boundaries) --
--    this is mechanically guaranteed correct regardless of what day
--    from_ts falls on.
-- ----------------------------------------------------------------------------
create or replace function public.next_friday_1900_utc(from_ts timestamptz default now())
returns timestamptz
language sql
stable
as $$
  select d + interval '17 hours'
  from generate_series(
    date_trunc('day', from_ts),
    date_trunc('day', from_ts) + interval '7 days',
    interval '1 day'
  ) as d
  where extract(dow from d) = 5 -- Friday
    and d + interval '17 hours' > from_ts
  order by d
  limit 1;
$$;

-- ----------------------------------------------------------------------------
-- 4. next_weekly_feature_start: where the NEXT auction queued into the
--    weekly program should start. 7 days after the last one already
--    queued/live in the program, or -- for the very first entry -- the
--    next upcoming Friday.
--
--    Anchoring every start to a Friday matters even though the program was
--    described as "auction 1 starts today": every auction runs exactly 28
--    days (an exact multiple of 7), so an auction's end always falls on
--    the same weekday as its start. For every auction to end on a Friday,
--    every one must also START on a Friday -- "starts today" only holds
--    when today already happens to be one.
-- ----------------------------------------------------------------------------
create or replace function public.next_weekly_feature_start()
returns timestamptz
language sql
stable
as $$
  select coalesce(
    (select max(starts_at) + interval '7 days'
     from public.auctions
     where is_weekly_feature = true),
    public.next_friday_1900_utc()
  );
$$;

-- ----------------------------------------------------------------------------
-- 5. Weekly checkpoint cron -- Fridays at 17:00 UTC (19:00 SAST), the exact
--    moment the outgoing weekly-feature auction ends. Reuses the
--    app_base_url/cron_secret Vault secrets 0011_pg_cron_sweeps.sql already
--    set up -- no new secret needed. See app/api/auctions/weekly-
--    checkpoint/route.ts's own header for what this does and, just as
--    importantly, what it deliberately does NOT do (close/publish).
-- ----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from cron.job where jobname = 'auctions-weekly-checkpoint') then
    perform cron.unschedule('auctions-weekly-checkpoint');
  end if;
end $$;

select cron.schedule(
  'auctions-weekly-checkpoint',
  '0 17 * * 5',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'app_base_url') || '/api/auctions/weekly-checkpoint',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 15000
  );
  $$
);

-- ============================================================================
-- End of migration 0046_staggered_weekly_auctions.sql
-- ============================================================================
