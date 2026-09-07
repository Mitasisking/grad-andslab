-- ============================================================================
-- Migration: 0026_add_shop_sports_card_products.sql
--
-- Extends the shop's products table to support Sports Cards alongside
-- Pokemon (app/shop/page.tsx's new master toggle), reusing the card_type
-- and sport enums already created for the submission wizard's own
-- Pokemon/Sports Cards split (0025_add_sports_card_fields.sql) -- same
-- concept, same values, no reason for a second pair of types.
--
-- card_variant is shop-specific (a sports card's own attribute: rookie,
-- autograph, memorabilia patch, numbered parallel, or a plain base card) --
-- not to be confused with card_type, which distinguishes Pokemon from
-- Sports Cards overall.
--
-- brand and player_name are left as plain text rather than enums/a lookup
-- table: brand has no fixed set (Topps/Panini/Upper Deck are examples
-- given, not an exhaustive list), and player_name is free-text search, not
-- a facet with a small fixed set of values.
--
-- NOTE: nothing currently creates a sports-card product row -- the only
-- import pipeline (app/api/admin/import-products/route.ts) reads a
-- Collectr export, which is Pokemon-only ("Collectr's own Category column
-- just says 'Pokemon'", per that route's own comment). The Sports Cards
-- toggle will correctly show zero results until real sports-card rows
-- exist -- that's a data problem for a future import path, not a bug in
-- this migration or the shop query logic.
-- ============================================================================

create type public.card_variant as enum ('rookie', 'auto', 'patch', 'parallel', 'base');

alter table public.products
  add column card_type    public.card_type not null default 'pokemon',
  add column sport        public.sport,
  add column card_variant public.card_variant,
  add column brand        text,
  add column player_name  text;

-- Same pairing principle as chk_submission_items_sport_matches_card_type
-- (0025) -- a sport only makes sense on a sports card. Unlike that table,
-- card_variant/brand/player_name aren't required even for a sports-card
-- row: a product can exist before it's fully tagged, and an
-- incompletely-tagged product just won't appear under facets it's missing,
-- rather than being blocked from being saved at all.
alter table public.products
  add constraint chk_products_sport_matches_card_type
  check (
    (card_type = 'sports_card' and sport is not null)
    or (card_type = 'pokemon' and sport is null)
  );

create index idx_products_card_type on public.products(card_type);
create index idx_products_sport on public.products(sport);

-- ============================================================================
-- End of migration 0026_add_shop_sports_card_products.sql
-- ============================================================================
