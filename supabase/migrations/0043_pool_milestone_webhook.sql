-- ============================================================================
-- Migration: 0043_pool_milestone_webhook.sql
--
-- Fires an outbound webhook (app/api/webhooks/pool-milestone/route.ts) the
-- moment a PCG/ACE submission pool (public.pools, 0035_submission_pools.sql)
-- CROSSES 25%, 50%, 75%, or 100% capacity, so marketing can post
-- FOMO-driven "our ACE Value pool is 75% full!" copy without a human
-- watching the admin dashboard for it.
--
-- "Crosses" rather than "reaches exactly" deliberately: current_count only
-- ever increments by 1 (public.sync_pool_count_on_insert(), one submission
-- at a time), but capacity isn't always divisible by 4 -- PCG's bulk tier
-- opens pools at capacity 50 (0035's own capacity logic), where 25% is 12.5
-- cards and 75% is 37.5. current_count can never land on a non-integer, so
-- a literal "current_count/capacity = 0.25" check would simply never fire
-- for that pool. Comparing old_pct < milestone <= new_pct catches the
-- threshold being passed regardless of whether it lands on a whole card,
-- and still fires each milestone exactly once as current_count rises
-- monotonically.
--
-- Same pg_net + Vault pattern as 0011_pg_cron_sweeps.sql, reusing that
-- migration's own 'app_base_url' secret. BEFORE this does anything useful,
-- set ONE additional Vault secret (SQL Editor) -- distinct from 0011's
-- 'cron_secret' since this is a different caller with a different trust
-- boundary (a database trigger firing on every pool update, not a
-- fixed-schedule cron sweep):
--
--   select vault.create_secret('a long random value', 'pool_milestone_webhook_secret');
--
-- That exact value must also be set as this Next.js deployment's
-- POOL_MILESTONE_WEBHOOK_SECRET environment variable -- app/api/webhooks/
-- pool-milestone/route.ts checks incoming requests against it the same way
-- app/api/auctions/close/route.ts checks CRON_SECRET. A mismatch fails
-- silently from Postgres's side (the route just returns 401; check
-- net._http_response if events seem to not be arriving).
-- ============================================================================

create extension if not exists pg_net;

create or replace function public.notify_pool_milestone()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_old_pct numeric;
  v_new_pct numeric;
  v_milestone int;
  v_base_url text;
  v_secret text;
begin
  -- Only PCG/ACE are active grading partners right now (matches the
  -- homepage hero's "Official PCG and ACE Middleman" copy and
  -- lib/pools/active-pools.ts's own scope) -- a PSA pool, if one ever
  -- exists, shouldn't trigger a marketing post for a partner we don't
  -- currently promote.
  if new.grading_company not in ('PCG', 'ACE') then
    return new;
  end if;

  if new.capacity is null or new.capacity <= 0 then
    return new;
  end if;

  v_old_pct := coalesce(old.current_count, 0)::numeric / new.capacity * 100;
  v_new_pct := coalesce(new.current_count, 0)::numeric / new.capacity * 100;

  select decrypted_secret into v_base_url from vault.decrypted_secrets where name = 'app_base_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'pool_milestone_webhook_secret';

  -- Both secrets missing (not configured yet) -- skip quietly rather than
  -- raise, so a pool's normal count-sync insert never fails because
  -- marketing's webhook isn't wired up yet.
  if v_base_url is null or v_secret is null then
    return new;
  end if;

  foreach v_milestone in array array[25, 50, 75, 100] loop
    if v_old_pct < v_milestone and v_new_pct >= v_milestone then
      perform net.http_post(
        url := v_base_url || '/api/webhooks/pool-milestone',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || v_secret,
          'Content-Type', 'application/json'
        ),
        body := jsonb_build_object(
          'pool_id', new.id,
          'grading_company', new.grading_company,
          'tier', new.tier,
          'label', new.label,
          'capacity', new.capacity,
          'current_count', new.current_count,
          'milestone_pct', v_milestone,
          'status', new.status
        ),
        timeout_milliseconds := 15000
      );
    end if;
  end loop;

  return new;
end;
$$;

-- AFTER UPDATE OF current_count: the only write path that changes
-- current_count is sync_pool_count_on_insert() (0035), which runs as its
-- own UPDATE distinct from the later status='closed' UPDATE -- so this
-- fires exactly once per submission landing in a pool, never a second time
-- when auto-close flips status right after.
create trigger trg_pools_notify_milestone
  after update of current_count on public.pools
  for each row execute function public.notify_pool_milestone();

-- ============================================================================
-- End of migration 0043_pool_milestone_webhook.sql
-- ============================================================================
