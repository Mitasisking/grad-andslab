-- ============================================================================
-- Migration: 0048_stripe_to_payfast_migration.sql
--
-- Stripe has been fully removed from the app (Payfast is now the only
-- payment processor — see lib/payments/payfast.ts, app/api/webhooks/
-- payfast/route.ts). This drops the columns that only ever existed to
-- support Stripe:
--
--   - bids.stripe_payment_intent_id / orders.stripe_payment_intent_id /
--     submissions.stripe_payment_intent_id -- held a PaymentIntent id for
--     reconciliation. Payfast has no equivalent object to reconcile
--     against; its m_payment_id round-trips as our own row id directly
--     (order.id, submission.id, or the winning bid's id for auctions --
--     see app/api/auctions/[id]/pay/route.ts), so no processor-side
--     identifier needs to be stored at all.
--   - profiles.stripe_customer_id / profiles.default_payment_method_id --
--     existed so auction bidders could be off-session charged on a saved
--     card without re-entering it each time. Bidding no longer takes any
--     payment up front (app/api/auctions/[id]/bid/route.ts) -- only the
--     eventual winner pays, once, via a Payfast redirect -- so there is no
--     "saved card" concept left to support.
--
-- public.payment_status keeps its 'authorized' value even though nothing
-- writes it anymore (Postgres enum values can't be cheaply dropped, and
-- 'pending' | 'captured' | 'failed' | 'refunded' already cover every state
-- the new flows use) -- an unused enum label is harmless.
-- ============================================================================

alter table public.bids drop column if exists stripe_payment_intent_id;
alter table public.orders drop column if exists stripe_payment_intent_id;
alter table public.submissions drop column if exists stripe_payment_intent_id;
alter table public.profiles drop column if exists stripe_customer_id;
alter table public.profiles drop column if exists default_payment_method_id;

-- ----------------------------------------------------------------------------
-- prevent_self_role_escalation() referenced the two profiles columns just
-- dropped above (guarding them as "system-controlled") -- replace it so it
-- only guards what still exists. Role escalation is still blocked exactly
-- as before.
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

  return new;
end;
$$;

-- ============================================================================
-- End of migration 0048_stripe_to_payfast_migration.sql
-- ============================================================================
