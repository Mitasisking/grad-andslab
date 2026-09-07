-- ============================================================================
-- Migration: 0032_multicurrency_checkout.sql
--
-- Follows 0031_add_product_region.sql (products.region). A product's price
-- is denominated in its own region's currency (ZAR/USD/GBP) -- never
-- converted -- so an order has to be region-locked too: every line item in
-- one order must share the same region, and the order remembers which one
-- so app/api/shop/checkout/route.ts knows which Stripe currency to charge
-- in instead of the hardcoded 'zar' it used before regions existed.
--
-- Rewrites create_order() (0009_stock_reservation.sql) to:
--   1. Track each locked product's region during the existing stock-check
--      pass, and reject the cart outright if two line items disagree --
--      "Not enough stock" and "no longer available" were already
--      first-class rejection reasons at this point, mixed regions is a
--      third.
--   2. Store the resolved region on the new orders.region column.
--
-- release_order_stock() is untouched -- it only ever gives stock back by
-- order_id, nothing about it depends on currency.
-- ============================================================================

alter table public.orders
  add column region public.product_region not null default 'sa';

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
  v_region public.product_region;
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

    if v_region is null then
      v_region := v_product.region;
    elsif v_region is distinct from v_product.region then
      raise exception 'Your cart has items from more than one region — please check out one region at a time.';
    end if;

    v_subtotal := v_subtotal + v_product.price * (v_item ->> 'quantity')::integer;
  end loop;

  insert into public.orders (user_id, address_id, shipping_address_snapshot, status, subtotal, shipping_cost, total, payment_status, region)
  values (
    v_user_id,
    p_address_id,
    to_jsonb(v_address),
    'pending',
    v_subtotal,
    coalesce(p_shipping_cost, 0),
    v_subtotal + coalesce(p_shipping_cost, 0),
    'pending',
    v_region
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

-- ============================================================================
-- End of migration 0032_multicurrency_checkout.sql
-- ============================================================================
