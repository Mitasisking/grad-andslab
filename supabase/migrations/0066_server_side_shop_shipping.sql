-- ============================================================================
-- 0066_server_side_shop_shipping.sql
--
-- Shop shipping is now fixed inside create_order() at R110 per order, and
-- the shop only sells in ZAR.
--
-- Before this, create_order() added whatever p_shipping_cost it was called
-- with, and the storefront passed a leftover flat 6.50 from the browser.
-- Because create_order() is granted to every authenticated user
-- (0008_rls_hardening_medium.sql), anyone signed in could call it directly
-- through PostgREST with p_shipping_cost = 0 and skip shipping entirely.
--
-- Changes versus 0056_raw_card_price_floor.sql's definition:
--   * p_shipping_cost is kept in the signature so the existing
--     /api/shop/orders route keeps working whichever of the app deploy or
--     this migration lands first, but its value is IGNORED. Shipping is
--     always v_shipping_zar (R110), which must match
--     lib/shop/shipping.ts's SHOP_SHIPPING_FLAT_RATE_ZAR.
--   * ZAR only: any product whose region isn't 'sa' is rejected, so the
--     R110 is never added to a USD/GBP-priced order. tax_rate and
--     exchange_rate_to_zar are therefore always 0.15 and 1.
--   * Each quantity must be a whole number of at least 1, checked before
--     anything is read or written (order_items.quantity > 0 would also
--     reject it, but only after the stock arithmetic had already run).
--   Everything else (row locks, stock check/decrement, the R100 Raw Card
--   floor, the orders/order_items inserts) is unchanged.
--
-- create or replace keeps the existing grant to authenticated.
-- ============================================================================

create or replace function public.create_order(
  p_address_id uuid,
  p_shipping_cost numeric, -- ignored; kept for signature compatibility
  p_items jsonb -- [{ "product_id": "...", "quantity": 2 }, ...]
)
returns public.orders
language plpgsql
security definer set search_path = public
as $$
declare
  v_shipping_zar constant numeric(12,2) := 110.00;
  v_user_id uuid := auth.uid();
  v_address public.addresses%rowtype;
  v_item jsonb;
  v_quantity_text text;
  v_product public.products%rowtype;
  v_subtotal numeric(12,2) := 0;
  v_order public.orders%rowtype;
  v_tax_rate constant numeric(5,4) := 0.15;
  v_total numeric(12,2);
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Cart is empty';
  end if;

  for v_item in select elem from jsonb_array_elements(p_items) as elem loop
    v_quantity_text := v_item ->> 'quantity';
    if v_quantity_text is null or v_quantity_text !~ '^[0-9]+$' or v_quantity_text::integer < 1 then
      raise exception 'Every quantity must be a whole number of at least 1';
    end if;
  end loop;

  select * into v_address from public.addresses where id = p_address_id and user_id = v_user_id;
  if not found then
    raise exception 'Address not found for this account';
  end if;

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
    if v_product.region is distinct from 'sa' then
      raise exception '"%" is not sold in South African Rand and cannot be ordered.', v_product.title;
    end if;
    if v_product.stock < (v_item ->> 'quantity')::integer then
      raise exception 'Not enough stock for "%"', v_product.title;
    end if;
    if v_product.category = 'cards' and v_product.price < 100 then
      raise exception 'Raw Cards under R100 are no longer sold individually — "%" is not available for purchase.', v_product.title;
    end if;

    v_subtotal := v_subtotal + v_product.price * (v_item ->> 'quantity')::integer;
  end loop;

  v_total := v_subtotal + v_shipping_zar;

  insert into public.orders (
    user_id, address_id, shipping_address_snapshot, status, subtotal, shipping_cost, total, payment_status,
    region, tax_rate, tax_collected, exchange_rate_to_zar
  )
  values (
    v_user_id,
    p_address_id,
    to_jsonb(v_address),
    'pending',
    v_subtotal,
    v_shipping_zar,
    v_total,
    'pending',
    'sa',
    v_tax_rate,
    round(v_total * v_tax_rate, 2),
    1
  )
  returning * into v_order;

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
-- End of migration 0066_server_side_shop_shipping.sql
-- ============================================================================
