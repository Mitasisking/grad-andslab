-- ============================================================================
-- Migration: 0056_raw_card_price_floor.sql
--
-- Premium price floor: Raw Cards (products.category = 'cards') under R100
-- are hidden from the public shop entirely (app/shop/page.tsx's own query),
-- but the shop grid isn't the only way a product id can reach create_order()
-- -- an old bookmarked/shared link straight to checkout, or a stale client
-- cart holding an item from before it dropped below the floor, would bypass
-- a browse-time-only filter. create_order() is this app's one real
-- checkout gate (every other money path already trusts it, per
-- 0034_accounting_foundations.sql's header), so the floor is enforced there
-- too, inside the same locked "Pass 1" loop that already checks stock --
-- checking under the row lock (not before it) is what keeps this
-- consistent with a concurrent admin price edit rather than racing it.
--
-- Full create_order() body carried forward unchanged from
-- 0034_accounting_foundations.sql except for the one new check inserted
-- into Pass 1, right after the existing stock check.
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
  v_region public.product_region;
  v_tax_rate numeric(5,4);
  v_exchange_rate numeric(10,6);
  v_total numeric(12,2);
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
    if v_product.category = 'cards' and v_product.price < 100 then
      raise exception 'Raw Cards under R100 are no longer sold individually — "%" is not available for purchase.', v_product.title;
    end if;

    if v_region is null then
      v_region := v_product.region;
    elsif v_region is distinct from v_product.region then
      raise exception 'Your cart has items from more than one region — please check out one region at a time.';
    end if;

    v_subtotal := v_subtotal + v_product.price * (v_item ->> 'quantity')::integer;
  end loop;

  v_total := v_subtotal + coalesce(p_shipping_cost, 0);

  -- Placeholder rates, kept in sync by hand with lib/shop/product-type.ts's
  -- REGION_TAX_RATE / REGION_EXCHANGE_RATE_TO_ZAR -- see
  -- 0034_accounting_foundations.sql's header comment.
  v_tax_rate := case v_region when 'uk' then 0.20 when 'sa' then 0.15 else 0 end;
  v_exchange_rate := case v_region when 'sa' then 1 when 'usa' then 18.5 when 'uk' then 18.5 / 0.79 end;

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
    coalesce(p_shipping_cost, 0),
    v_total,
    'pending',
    v_region,
    v_tax_rate,
    round(v_total * v_tax_rate, 2),
    v_exchange_rate
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
-- End of migration 0056_raw_card_price_floor.sql
-- ============================================================================
