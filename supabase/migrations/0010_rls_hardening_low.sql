-- ============================================================================
-- Migration: 0010_rls_hardening_low.sql
-- Fixes the Low/informational findings from the RLS security audit:
--
--   7. profiles: stripe_customer_id / default_payment_method_id were
--      client-writable, same shape as the role-escalation bug 0007 fixed —
--      lower severity on its own (Stripe still enforces that a
--      payment_method belongs to its customer at charge time), but if an
--      attacker ever learned a victim's real Stripe ids through some other
--      leak, writing both onto their own profile would let them place a
--      bid that charges the victim's saved card. Extends 0007's trigger
--      rather than adding a second one.
--
--   8. bids: stripe_payment_intent_id was readable by anyone via
--      bids_select_public (using (true)) — a payment infrastructure
--      identifier with no legitimate public display use, unlike
--      bidder_id/amount which bid-history.tsx actually renders.
--
--   9. storage: 0003_storage.sql (creates the submission-photos bucket +
--      admin-only write policies) was never delivered, despite
--      app/api/admin/intake/{photo,photo-confirm}/route.ts already assuming
--      it exists. Written here: admin-only write, public read. Public read
--      is a deliberate choice, not a default — see the comment below.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 7. profiles: extend the existing role-escalation guard from
--    0007_rls_hardening.sql to also cover these two columns. Not a new
--    trigger — CREATE OR REPLACE on the same function name, so the trigger
--    already attached to profiles picks up the new body automatically.
-- ----------------------------------------------------------------------------
create or replace function public.prevent_self_role_escalation()
returns trigger
language plpgsql
as $$
begin
  if auth.role() = 'service_role' or public.is_admin() then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'Only an admin can change a profile''s role';
  end if;

  if new.stripe_customer_id is distinct from old.stripe_customer_id then
    raise exception 'stripe_customer_id is system-controlled';
  end if;

  if new.default_payment_method_id is distinct from old.default_payment_method_id then
    raise exception 'default_payment_method_id is system-controlled';
  end if;

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 8. bids: narrow public read to the columns the UI actually renders.
--    Supabase grants column SELECT to anon/authenticated by default, so
--    this needs an explicit revoke, not just a change to the RLS policy
--    (RLS is row-level; it can't restrict columns on its own).
-- ----------------------------------------------------------------------------
revoke select (stripe_payment_intent_id) on public.bids from anon, authenticated;

-- ----------------------------------------------------------------------------
-- 9. storage: submission-photos bucket.
--
--    Read is public (bucket-level `public = true`, independent of RLS)
--    rather than admin-only or signed-URL-scoped. Deliberate: these photos
--    are served with plain <img src> tags in components/admin/intake-order-
--    panel.tsx (no way to attach an auth header to an <img> request), and
--    the same photo is meant to go fully public anyway the moment the card
--    is listed on auction (components/auctions/auction-draft-form.tsx pre-
--    fills the listing's images straight from hi_res_photo_url). If intake
--    photos should stay private until listed, that's a product decision —
--    switch to storage.createSignedUrl() with a real expiry and re-issue it
--    per view, which needs its own follow-up.
--
--    Write (insert/update/delete) is admin-only, matching requireAdmin()
--    already gating the only two routes that touch this bucket.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('submission-photos', 'submission-photos', true)
on conflict (id) do nothing;

drop policy if exists "submission_photos_admin_insert" on storage.objects;
create policy "submission_photos_admin_insert"
  on storage.objects for insert
  with check (bucket_id = 'submission-photos' and public.is_admin());

drop policy if exists "submission_photos_admin_update" on storage.objects;
create policy "submission_photos_admin_update"
  on storage.objects for update
  using (bucket_id = 'submission-photos' and public.is_admin())
  with check (bucket_id = 'submission-photos' and public.is_admin());

drop policy if exists "submission_photos_admin_delete" on storage.objects;
create policy "submission_photos_admin_delete"
  on storage.objects for delete
  using (bucket_id = 'submission-photos' and public.is_admin());

-- ============================================================================
-- End of migration 0010_rls_hardening_low.sql
-- ============================================================================
