-- ============================================================================
-- Migration: 0064_add_event_settings_name.sql
--
-- Adds a human-readable event name alongside the machine slug already on
-- public.event_settings (0062_add_in_person_event_intake.sql) -- e.g.
-- active_event_slug = 'comic-con-jhb', active_event_name = 'Comic Con
-- Johannesburg 2026'. The slug still drives the ?event=slug URL param and
-- the booth-generated shareable link; the name is purely a display string
-- for the admin panel and the /submit wizard's "Live Intake Active" badge.
--
-- Nullable with no default, so this adds cleanly against the existing
-- singleton row -- no backfill needed, no RLS change needed (the existing
-- event_settings_select_anyone / event_settings_update_admin_only policies
-- from 0062 already apply to the whole row, this column included).
-- ============================================================================

alter table public.event_settings
  add column active_event_name text;

-- ============================================================================
-- End of migration 0064_add_event_settings_name.sql
-- ============================================================================
