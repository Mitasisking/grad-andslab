-- ============================================================================
-- Migration: 0015_dedupe_products.sql
-- app/api/admin/import-products/route.ts matched existing rows on
-- (title, set_name, card_number). When Collectr's export started supplying
-- set_name for sealed products that previously had it blank, a re-import
-- read that as a *different* product (same title, different set_name) and
-- inserted a new row instead of updating the old one -- leaving 20 sealed
-- products duplicated, one copy permanently stuck with an empty set_name
-- (confirmed by hand: every single one of these 20 pairs has an identical
-- title, one row with set_name populated and one without, nothing else
-- distinguishing them).
--
-- This is a one-time cleanup for data the bug already produced. The bug
-- itself is fixed in the route (matching on title alone from here on), not
-- here -- rerunning this migration is safe either way, since it only ever
-- deletes a row that has a same-titled sibling with real set_name data.
-- ============================================================================

delete from public.products p1
where (p1.set_name is null or p1.set_name = '')
  and exists (
    select 1 from public.products p2
    where p2.title = p1.title
      and p2.id <> p1.id
      and p2.set_name is not null
      and p2.set_name <> ''
  );

-- ============================================================================
-- End of migration 0015_dedupe_products.sql
-- ============================================================================
