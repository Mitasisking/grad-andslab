-- ============================================================================
-- Migration: 0009_stock_reservation.sql
-- Fixes the stock race left by 0008: create_order() checked stock but never
-- held it, so two concurrent orders for the last unit could both pass the
-- check — nothing was actually reserved until payment capture, by which
-- point it's too late to tell the second customer their cart won't fulfill.
--
-- The fix has two halves:
--   1. create_order() now locks each product row (SELECT ... FOR UPDATE)
--      before checking stock, and decrements it immediately as part of the
--      same transaction — the reservation happens atomically with the
--      check, so a second concurrent order genuinely cannot also succeed
--      for the same last unit.
--   2. Since stock is now held from the moment of order creation, an order
--      that's never paid has to give it back. Two release paths, both
--      calling the new release_order_stock():
--        a. Stripe's payment_intent.payment_failed — the webhook already
--           sees this (see the accompanying code change).
--        b. A cart that's abandoned before ever attempting payment, so no
--           Stripe event fires at all — handled by a new cron-invoked
--           sweep, app/api/shop/orders/release-stale/route.ts, the same
--           shape as the existing app/api/auctions/close/route.ts.
--
-- decrement_product_stock() (0005) is left in place but is no longer called
-- from the webhook now that reservation happens at creation time instead of
-- capture time — kept as a general-purpose helper (e.g. a future manual
-- admin stock adjustment), just not part of this flow anymore.
-- ============================================================================

create or replace function public.create_order(
  p_address_id uuid,
  p_shipping_cost numeric,
  p_items jsonb -- [{ "product_id": "...", "quantity": 2 }, ...]
)
returns public.orders
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_address public.addresses%rowtype;
  v_item jsonb;
  v_product public.products%rowtype;
  v_subtotal numeric(12,2) := 0;
  v_order public.orders%rowtype;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Cart is empty';
  end if;

  select * into v_address from public.addresses where id = p_address_id and user_id = v_user_id;
  if not found then
    raise exception 'Address not found for this account';
  end if;

  -- Pass 1: lock every product row up front, in a consistent order (by id)
  -- so two orders sharing products can't deadlock waiting on each other's
  -- locks in opposite order. Holding the lock across both passes is what
  -- makes the check-then-reserve atomic — nothing else can touch these
  -- rows until this transaction commits or rolls back.
  for v_item in
    select elem from jsonb_array_elements(p_items) as elem
    order by elem ->> 'product_id'
  loop
    select * into v_product from public.products
      where id = (v_item ->> 'product_id')::uuid and is_active = true
      for update;

    if not found then
      raise exception 'A product in your cart is no longer available';
    end if;
    if v_product.stock < (v_item ->> 'quantity')::integer then
      raise exception 'Not enough stock for "%"', v_product.title;
    end if;

    v_subtotal := v_subtotal + v_product.price * (v_item ->> 'quantity')::integer;
  end loop;

  insert into public.orders (user_id, address_id, shipping_address_snapshot, status, subtotal, shipping_cost, total, payment_status)
  values (
    v_user_id,
    p_address_id,
    to_jsonb(v_address),
    'pending',
    v_subtotal,
    coalesce(p_shipping_cost, 0),
    v_subtotal + coalesce(p_shipping_cost, 0),
    'pending'
  )
  returning * into v_order;

  -- Pass 2: write the line items and reserve the stock in the same
  -- transaction as pass 1's check — still holding pass 1's locks.
  for v_item in
    select elem from jsonb_array_elements(p_items) as elem
  loop
    select * into v_product from public.products where id = (v_item ->> 'product_id')::uuid;

    insert into public.order_items (order_id, product_id, title, unit_price, quantity)
    values (v_order.id, v_product.id, v_product.title, v_product.price, (v_item ->> 'quantity')::integer);

    update public.products
    set stock = stock - (v_item ->> 'quantity')::integer
    where id = v_product.id;
  end loop;

  return v_order;
end;
$$;

-- Gives back the stock create_order() reserved, for an order that's never
-- going to be paid (failed payment, or abandoned past the reservation
-- window). One statement covers every line item on the order at once.
create or replace function public.release_order_stock(p_order_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.products p
  set stock = p.stock + oi.quantity
  from public.order_items oi
  where oi.order_id = p_order_id
    and oi.product_id = p.id;
end;
$$;

-- Supabase grants EXECUTE on new functions to anon/authenticated by
-- default — this one must only ever run from trusted server code (the
-- webhook, the release-stale sweep), never a client picking an arbitrary
-- order id to un-decrement stock on. create_order() doesn't need this
-- treatment since it already validates auth.uid() and ownership itself.
revoke execute on function public.release_order_stock(uuid) from public, anon, authenticated;
grant execute on function public.release_order_stock(uuid) to service_role;

-- ============================================================================
-- End of migration 0009_stock_reservation.sql
-- ============================================================================
