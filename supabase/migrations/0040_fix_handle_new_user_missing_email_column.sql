-- ============================================================================
-- Migration: 0040_fix_handle_new_user_missing_email_column.sql
-- Fixes a signup-breaking bug discovered by actually testing /my-account's
-- Register form end-to-end: public.profiles in production does NOT have an
-- email column (confirmed via information_schema.columns against the live
-- database), even though every migration back to 0001_init_schema.sql
-- defines one. The live table also has columns no migration file mentions
-- (street_address, city, postal_code, country, phone, role text default
-- 'customer', is_admin boolean) -- production profiles predates the
-- "rebuild" this migration history describes and was never brought in
-- line with it. That's a standing discrepancy this migration does NOT
-- attempt to resolve (only 1 real row exists today, so low urgency, but it
-- affects more than this function -- e.g. app/admin/pools/page.tsx and
-- lib/email/send-order-confirmation.ts both select profiles(email) and
-- are likely broken in production the same way, unverified as of this
-- migration).
--
-- This migration only removes the email insert so signup stops failing
-- with GoTrue's generic "Database error saving new user" (the real
-- Postgres error, "column email of relation profiles does not exist", is
-- swallowed by the auth layer and never reaches the client).
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, newsletter_opt_in)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    coalesce((new.raw_user_meta_data ->> 'newsletter_opt_in')::boolean, false)
  );
  return new;
end;
$$;

-- ============================================================================
-- End of migration 0040_fix_handle_new_user_missing_email_column.sql
-- ============================================================================
