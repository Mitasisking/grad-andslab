-- ============================================================================
-- Migration: 0011_pg_cron_sweeps.sql
-- Schedules the two cron-invoked sweeps that nothing else calls on its own:
--   - app/api/auctions/close      (settle auctions whose ends_at has passed)
--   - app/api/shop/orders/release-stale (release stock reserved by carts
--     that were abandoned before ever attempting payment)
-- Both are CRON_SECRET-protected HTTP routes, not database functions, so
-- reaching them from Postgres needs pg_net (async HTTP) alongside pg_cron
-- (the scheduler) — pg_cron alone can only run SQL, not call a URL.
--
-- BEFORE this does anything useful, set two Vault secrets (SQL Editor):
--
--   select vault.create_secret('https://your-deployed-app.example.com', 'app_base_url');
--   select vault.create_secret('the exact CRON_SECRET value', 'cron_secret');
--
-- `cron_secret` must be byte-for-byte the same value as the CRON_SECRET
-- environment variable your Next.js deployment actually reads
-- (process.env.CRON_SECRET in both routes) — a mismatch here fails silently
-- from Postgres's side (the route just returns 401; pg_net doesn't surface
-- that as a loud error, it lands in net._http_response for you to check).
--
-- Both lookups happen at each job's execution time, not at migration-apply
-- time, so it's fine to run this migration before or after creating the
-- two secrets above — either order ends with working jobs once both exist.
-- Rotating either secret later just needs vault.update_secret(), not a new
-- migration or a reschedule.
-- ============================================================================

-- Matches Supabase's own documented convention exactly: no explicit schema
-- clause — both extensions install into their own fixed schema (cron, net)
-- regardless, and that's what every call below references.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ----------------------------------------------------------------------------
-- auctions/close — every minute, matching the README's own suggested cadence
-- ("calling this URL every minute or so") and the anti-sniping trigger's
-- own 30-second/2-minute granularity (0006_auctions.sql).
-- ----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from cron.job where jobname = 'auctions-close') then
    perform cron.unschedule('auctions-close');
  end if;
end $$;

select cron.schedule(
  'auctions-close',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'app_base_url') || '/api/auctions/close',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 15000
  );
  $$
);

-- ----------------------------------------------------------------------------
-- shop/orders/release-stale — every 5 minutes. The 30-minute reservation
-- window (RESERVATION_MINUTES in the route itself) isn't time-critical the
-- way an auction's end time is, so this doesn't need minute-level cadence.
-- ----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from cron.job where jobname = 'shop-orders-release-stale') then
    perform cron.unschedule('shop-orders-release-stale');
  end if;
end $$;

select cron.schedule(
  'shop-orders-release-stale',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'app_base_url') || '/api/shop/orders/release-stale',
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
-- End of migration 0011_pg_cron_sweeps.sql
-- ============================================================================
