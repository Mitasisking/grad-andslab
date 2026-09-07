-- ============================================================================
-- Migration: 0027_add_baseball_football_sports.sql
--
-- Expands public.sport (0025_add_sports_card_fields.sql) from the original
-- 5 sports (soccer, rugby, f1, nhl, nba) to also cover Baseball and
-- American Football -- needed to seed the client's sports_card_database.csv
-- test data, ~40% of which is one of these two. Named mlb/nfl to match the
-- existing abbreviation style nhl/nba already use (soccer/rugby/f1 are
-- literal sport names since those don't have one dominant pro league the
-- way hockey/basketball/baseball/American football do in this data).
--
-- Shared by both the submission wizard's Sports Cards flow
-- (lib/submission-types.ts's Sport type, app/api/sports-cards/search's
-- per-sport query fan-out) and the shop's Sport filter
-- (components/shop/sports-card-filters.tsx) -- both got their
-- SPORT_OPTIONS/SPORT_KEYWORD maps updated alongside this migration so
-- neither is left silently out of sync with what the database now allows.
-- ============================================================================

alter type public.sport add value if not exists 'mlb';
alter type public.sport add value if not exists 'nfl';

-- ============================================================================
-- End of migration 0027_add_baseball_football_sports.sql
-- ============================================================================
