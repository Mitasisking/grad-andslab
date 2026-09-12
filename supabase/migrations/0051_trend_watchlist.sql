-- ============================================================================
-- Migration: 0051_trend_watchlist.sql
--
-- Backs the "Add to Watchlist" action on /admin/trends (app/admin/trends/
-- trends-dashboard.tsx): lets an admin bookmark a market_trends
-- recommendation they intend to actually go source, separate from the
-- read-only AI-generated feed itself. Admin-only in every direction, same
-- trust level as market_trends (0050_market_trends.sql) -- this is an
-- internal shortlist, not customer-facing data.
--
-- card_name/set_name are copied onto the row (not just looked up via
-- market_trend_id) so a bookmark still shows what it was for even if the
-- source market_trends row is ever pruned -- market_trend_id references it
-- with on delete cascade for the common case, but the copied text is what
-- actually renders.
-- ============================================================================

create table public.trend_watchlist (
  id                uuid primary key default gen_random_uuid(),
  market_trend_id   uuid not null references public.market_trends(id) on delete cascade,
  card_name         text not null,
  set_name          text not null,
  added_by          uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  unique (market_trend_id)
);

create index idx_trend_watchlist_created_at on public.trend_watchlist(created_at desc);

alter table public.trend_watchlist enable row level security;

create policy "trend_watchlist_select_admin_only"
  on public.trend_watchlist for select
  using (public.is_admin());

create policy "trend_watchlist_insert_admin_only"
  on public.trend_watchlist for insert
  with check (public.is_admin());

create policy "trend_watchlist_delete_admin_only"
  on public.trend_watchlist for delete
  using (public.is_admin());

-- ============================================================================
-- End of migration 0051_trend_watchlist.sql
-- ============================================================================
