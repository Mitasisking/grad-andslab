-- ============================================================================
-- Migration: 0050_market_trends.sql
--
-- Stores AI-generated "buy raw & grade" arbitrage insights (see
-- app/api/cron/market-trends/route.ts). Admin-only in every direction --
-- same trust level as grading_tier_costs (0034_accounting_foundations.sql):
-- internal business intelligence, never something a customer's own RLS
-- access should extend to.
--
-- IMPORTANT: as of this migration, the two data sources this feeds from
-- (lib/market-trends/english-pricing.ts, lib/market-trends/japanese-pricing.ts)
-- are unwired stubs -- there is no real PokemonPriceTracker/TCGplayer/
-- PriceCharting integration behind them yet (no verified API docs were
-- available to build against -- see those files' own header comments).
-- The cron route deliberately refuses to insert rows while running against
-- stub data (checks isPlaceholder on the fetched data) specifically so
-- this table never fills up with LLM output computed over fabricated
-- prices and gets mistaken for real trading advice. It starts populating
-- for real the moment those two fetchers are wired up.
-- ============================================================================

create table public.market_trends (
  id                 uuid primary key default gen_random_uuid(),
  card_name          text not null,
  set_name           text not null,
  language           text not null check (language in ('english', 'japanese')),
  raw_estimate        numeric(12,2) not null check (raw_estimate >= 0),
  graded_estimate     numeric(12,2) not null check (graded_estimate >= 0),
  profit_multiplier   numeric(8,3) not null,
  actionable_advice   text not null,
  created_at          timestamptz not null default now()
);

create index idx_market_trends_profit_multiplier on public.market_trends(profit_multiplier desc);
create index idx_market_trends_created_at on public.market_trends(created_at desc);

alter table public.market_trends enable row level security;

create policy "market_trends_select_admin_only"
  on public.market_trends for select
  using (public.is_admin());

-- No insert/update/delete policy for any client role -- only the
-- service-role client app/api/cron/market-trends/route.ts uses (bypassing
-- RLS entirely, same as every other CRON_SECRET-protected route in this
-- app) ever writes here.

-- ----------------------------------------------------------------------------
-- Cron: twice daily, matching the cadence already established for
-- update-exchange-rate (0049_exchange_rates.sql) -- 06:00 and 15:00 UTC
-- (08:00 and 17:00 SAST). Same pg_cron + pg_net + app_base_url/cron_secret
-- Vault-secret pattern as every other scheduled job in this app.
-- ----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from cron.job where jobname = 'market-trends') then
    perform cron.unschedule('market-trends');
  end if;
end $$;

select cron.schedule(
  'market-trends',
  '0 6,15 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'app_base_url') || '/api/cron/market-trends',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    -- LLM calls (three of them, sequentially) run considerably longer than
    -- this app's other cron routes -- 15s would false-timeout this one.
    timeout_milliseconds := 60000
  );
  $$
);

-- ============================================================================
-- End of migration 0050_market_trends.sql
-- ============================================================================
