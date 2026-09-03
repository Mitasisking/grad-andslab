-- ============================================================================
-- Migration: 0007_rls_hardening.sql
-- Fixes the Critical/High findings from the RLS security audit: every "own
-- row" UPDATE/INSERT policy so far has checked ownership but not which
-- columns an owner may touch, letting a client with nothing but their own
-- JWT write system-controlled columns directly — bypassing every
-- Next.js route that was supposed to be the only path to those writes.
--
--   1. profiles: self-service admin escalation via the `role` column.
--   2. auctions: sellers could rewrite their own bid state directly.
--   3. bids: bids could be inserted without ever touching Stripe.
--   4. submissions / submission_items: customers could self-certify grades
--      and payment status.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. profiles: block role changes by anyone but an admin (or the trusted
--    service-role path), without touching the existing "own row" UPDATE
--    policy that legitimately lets a user edit their name/phone/address.
-- ----------------------------------------------------------------------------
create or replace function public.prevent_self_role_escalation()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role
     and auth.role() <> 'service_role'
     and not public.is_admin()
  then
    raise exception 'Only an admin can change a profile''s role';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_protect_role on public.profiles;
create trigger trg_profiles_protect_role
  before update on public.profiles
  for each row execute function public.prevent_self_role_escalation();

-- ----------------------------------------------------------------------------
-- 2. auctions: the seller may still edit listing metadata (title,
--    description, images, reserve_price) up until the auction has its first
--    bid — but current_high_bid, current_high_bidder_id, status,
--    extension_count, seller_id, and item_id are system-controlled: written
--    only by lib/auctions/finalize-bid.ts (service role, on a confirmed
--    Stripe hold) or app/api/auctions/close/route.ts (service role, cron).
--    auth.role() = 'service_role' keeps those two paths working unaffected.
-- ----------------------------------------------------------------------------
create or replace function public.protect_auction_system_columns()
returns trigger
language plpgsql
as $$
begin
  if auth.role() = 'service_role' or public.is_admin() then
    return new;
  end if;

  if new.current_high_bid is distinct from old.current_high_bid
     or new.current_high_bidder_id is distinct from old.current_high_bidder_id
     or new.status is distinct from old.status
     or new.extension_count is distinct from old.extension_count
     or new.seller_id is distinct from old.seller_id
     or new.item_id is distinct from old.item_id
  then
    raise exception 'Only the system can change an auction''s bid state';
  end if;

  if old.current_high_bid is not null then
    raise exception 'This listing can no longer be edited once it has a bid';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_auctions_protect_system_columns on public.auctions;
create trigger trg_auctions_protect_system_columns
  before update on public.auctions
  for each row execute function public.protect_auction_system_columns();

-- ----------------------------------------------------------------------------
-- 3. bids: finalizeAuthorizedBid() writes bids with the service-role client,
--    which bypasses RLS entirely — nothing in the real bidding flow needs a
--    client-facing INSERT policy on this table. Dropping it closes the only
--    way a bid could be fabricated (arbitrary amount, fake
--    stripe_payment_intent_id, payment_status set straight to 'captured')
--    without ever touching Stripe. bids_select_public (read) is untouched.
-- ----------------------------------------------------------------------------
drop policy if exists "bids_insert_own" on public.bids;

-- ----------------------------------------------------------------------------
-- 4. submissions / submission_items: no code path in the app updates either
--    table as the owning customer — every real status/grade change goes
--    through requireAdmin()-gated routes (admin/intake/status,
--    admin/grading/save), whose session-scoped client already satisfies
--    is_admin(). Dropping the "own" branch removes the client's ability to
--    self-mark payment_status = 'captured' or fabricate a grade_result.
-- ----------------------------------------------------------------------------
drop policy if exists "submissions_update_own_or_admin" on public.submissions;
create policy "submissions_update_admin_only"
  on public.submissions for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "submission_items_update_own_or_admin" on public.submission_items;
create policy "submission_items_update_admin_only"
  on public.submission_items for update
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================================
-- End of migration 0007_rls_hardening.sql
-- ============================================================================
