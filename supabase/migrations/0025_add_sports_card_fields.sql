-- ============================================================================
-- Migration: 0025_add_sports_card_fields.sql
--
-- Adds Sports Cards as a second card type alongside Pokemon in the
-- submission wizard (components/submit/card-shipment-row.tsx). The existing
-- card_name/set_name/card_number columns already fit both: for a sports
-- card, card_name holds the player name and set_name holds the brand/set
-- (e.g. "2023 Topps Chrome") -- no need for parallel player_name/brand_set
-- columns that would just duplicate them. What's genuinely new is:
--   - card_type: which of the two flows this item came from
--   - sport: only meaningful for card_type = 'sports_card'
--   - year: sports cards are commonly cataloged by year, Pokemon cards by set
--   - external_card_id / external_source: the catalog API's product id and
--     which provider it came from (app/api/sports-cards/search/route.ts),
--     kept for the same reason market_value_source already exists -- so a
--     submission can be traced back to the exact catalog entry a customer
--     or admin selected, not just its free-text name.
-- ============================================================================

create type public.card_type as enum ('pokemon', 'sports_card');
create type public.sport as enum ('soccer', 'rugby', 'f1', 'nhl', 'nba');

alter table public.submission_items
  add column card_type       public.card_type not null default 'pokemon',
  add column sport           public.sport,
  add column year            text,
  add column external_card_id text,
  add column external_source  text;

-- A sport only makes sense on a sports card, and every sports card needs one
-- -- mirrors the same paired-column pattern as
-- 0023_allow_pcg_psa_ace_grading.sql's tier/company check.
alter table public.submission_items
  add constraint chk_submission_items_sport_matches_card_type
  check (
    (card_type = 'sports_card' and sport is not null)
    or (card_type = 'pokemon' and sport is null)
  );

create index idx_submission_items_card_type on public.submission_items(card_type);

-- ============================================================================
-- End of migration 0025_add_sports_card_fields.sql
-- ============================================================================
