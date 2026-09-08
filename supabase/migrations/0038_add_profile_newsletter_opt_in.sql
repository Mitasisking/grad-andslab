-- ============================================================================
-- Migration: 0038_add_profile_newsletter_opt_in.sql
-- Adds a "Subscribe to our newsletter" preference for the new /my-account
-- Register form (app/my-account/page.tsx). Follows the same path full_name
-- already takes: the client passes it in auth.signUp's options.data (which
-- Postgres exposes to handle_new_user() as new.raw_user_meta_data), and the
-- trigger below copies it onto the profiles row at signup time.
-- ============================================================================

alter table public.profiles
  add column newsletter_opt_in boolean not null default false;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, newsletter_opt_in)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    coalesce((new.raw_user_meta_data ->> 'newsletter_opt_in')::boolean, false)
  );
  return new;
end;
$$;

-- ============================================================================
-- End of migration 0038_add_profile_newsletter_opt_in.sql
-- ============================================================================
