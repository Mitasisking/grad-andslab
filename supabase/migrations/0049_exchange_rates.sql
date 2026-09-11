-- ============================================================================
-- Migration: 0049_exchange_rates.sql
--
-- GBP->ZAR rate tracking for pricing PCG/ACE grading tiers accurately. PCG
-- and ACE both bill in GBP (see lib/submission-types.ts's own header
-- comment -- their tiers' basePriceGBP is the real, business-set cost);
-- basePriceZAR next to it is currently a hand-set, one-time conversion that
-- drifts as the real rate moves. This table is the live, buffered rate that
-- replaces that guess -- see lib/pricing/exchange-rate.ts's
-- convertGbpToZar() for the read side, and
-- app/api/cron/update-exchange-rate/route.ts for what writes new rows here.
--
-- Append-only by design (a new row per sync, not an upsert) -- keeps a real
-- history of what the rate/buffer was at any point in time, which matters
-- for reconciling what a past submission was actually priced at. Callers
-- always want the latest row (order by updated_at desc limit 1).
-- ============================================================================

create table public.exchange_rates (
  id              uuid primary key default gen_random_uuid(),
  from_currency   text not null,
  to_currency     text not null,
  spot_rate       numeric(12,6) not null check (spot_rate > 0),
  buffer_percent  numeric(5,2) not null default 3.5,
  effective_rate  numeric(12,6) not null check (effective_rate > 0),
  updated_at      timestamptz not null default now()
);

-- Every lookup is "give me the latest rate for this currency pair" -- see
-- getLatestExchangeRate() in lib/pricing/exchange-rate.ts.
create index idx_exchange_rates_pair_updated_at
  on public.exchange_rates (from_currency, to_currency, updated_at desc);

alter table public.exchange_rates enable row level security;

-- Publicly readable: the effective_rate is what's ultimately reflected in a
-- displayed ZAR price on /submit, a page anonymous visitors already see --
-- same trust level as products.price. Nothing (not even authenticated
-- users) can write to it via the client; only the service-role client the
-- cron route uses (app/api/cron/update-exchange-rate/route.ts, protected by
-- CRON_SECRET) bypasses RLS to insert new rows.
create policy "exchange_rates_select_public"
  on public.exchange_rates for select
  using (true);

-- ----------------------------------------------------------------------------
-- Cron: sync twice daily, 06:00 and 15:00 UTC (08:00 and 17:00 SAST -- South
-- Africa has no daylight saving, so that offset never drifts). One
-- cron.schedule call with a comma-separated hour list covers both times.
--
-- Deliberately pg_cron, not Vercel Cron (vercel.json): every other
-- scheduled job in this app already runs this way (0011_pg_cron_sweeps.sql,
-- 0046_staggered_weekly_auctions.sql) reusing the same app_base_url/
-- cron_secret Vault secrets, and Vercel's Hobby plan caps Vercel Cron jobs
-- at once per day -- it can't actually run this twice-daily schedule at
-- all on that plan. If this project is ever on a paid Vercel plan and you'd
-- rather consolidate scheduling there instead, the equivalent vercel.json
-- entry is:
--   { "crons": [{ "path": "/api/cron/update-exchange-rate", "schedule": "0 6,15 * * *" }] }
-- (Vercel signs those requests itself rather than a bearer secret, so the
-- route's auth check would need adjusting to match if you switch.)
-- ----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from cron.job where jobname = 'update-exchange-rate') then
    perform cron.unschedule('update-exchange-rate');
  end if;
end $$;

select cron.schedule(
  'update-exchange-rate',
  '0 6,15 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'app_base_url') || '/api/cron/update-exchange-rate',
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
-- End of migration 0049_exchange_rates.sql
-- ============================================================================
