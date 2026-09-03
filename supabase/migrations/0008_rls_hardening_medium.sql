-- ============================================================================
-- Migration: 0008_rls_hardening_medium.sql
-- Fixes the Medium findings from the RLS security audit:
--
--   5. submission_status_log: the owner-insert branch let a customer forge
--      audit-trail entries (changed_by was never pinned to auth.uid()) for
--      a feature — the initial 'received' log row — that app/api/submissions
--      never actually wrote. Replaced with a trigger that writes that row
--      itself, so no client-facing insert permission is needed at all.
--
--   6. orders / order_items: a client could insert an order directly with
--      an attacker-chosen total/subtotal/unit_price, bypassing the
--      stock/price re-verification app/api/shop/orders/route.ts performs.
--      Order creation now goes through create_order(), a SECURITY DEFINER
--      RPC that looks up price/stock from public.products itself — the
--      client can only ever supply product ids and quantities. This also
--      makes creation atomic (orders + order_items in one transaction),
--      fixing the partial-insert risk the old two-step app code had.
--      NOTE: app/api/shop/orders/route.ts must call this RPC instead of
--      inserting directly, or it will start failing once this migration
--      lands — see the accompanying code change.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 5. submission_status_log
-- ----------------------------------------------------------------------------
create or replace function public.log_initial_submission_status()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.submission_status_log (submission_id, from_status, to_status, changed_by, reason)
  values (new.id, null, new.status, new.user_id, 'Submission created');
  return new;
end;
$$;

drop trigger if exists trg_submissions_log_initial_status on public.submissions;
create trigger trg_submissions_log_initial_status
  after insert on public.submissions
  for each row execute function public.log_initial_submission_status();

drop policy if exists "status_log_insert_admin_or_owner" on public.submission_status_log;
create policy "status_log_insert_admin_only"
  on public.submission_status_log for insert
  with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 6. orders / order_items
-- ----------------------------------------------------------------------------
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

  -- Verify stock/price for every line before writing anything.
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_product from public.products
      where id = (v_item ->> 'product_id')::uuid and is_active = true;

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

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_product from public.products where id = (v_item ->> 'product_id')::uuid;

    insert into public.order_items (order_id, product_id, title, unit_price, quantity)
    values (v_order.id, v_product.id, v_product.title, v_product.price, (v_item ->> 'quantity')::integer);
  end loop;

  return v_order;
end;
$$;

grant execute on function public.create_order(uuid, numeric, jsonb) to authenticated;

drop policy if exists "orders_insert_own" on public.orders;
create policy "orders_insert_admin_only"
  on public.orders for insert
  with check (public.is_admin());

drop policy if exists "order_items_insert_own_or_admin" on public.order_items;
create policy "order_items_insert_admin_only"
  on public.order_items for insert
  with check (public.is_admin());

-- ============================================================================
-- End of migration 0008_rls_hardening_medium.sql
-- ============================================================================
