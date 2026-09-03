-- ============================================================================
-- Migration: 0005_marketplace.sql
-- Adds orders/order_items for e-commerce checkout, a saved default payment
-- method on profiles (so auction bidders aren't asked to re-enter a card on
-- every bid), and an atomic stock-decrement function used on order payment.
-- ============================================================================

create type public.order_status as enum ('pending', 'paid', 'fulfilled', 'cancelled');

create table public.orders (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null references public.profiles(id) on delete cascade,
  address_id                uuid references public.addresses(id) on delete set null,
  shipping_address_snapshot jsonb,
  status                    public.order_status not null default 'pending',
  subtotal                  numeric(12,2) not null default 0 check (subtotal >= 0),
  shipping_cost             numeric(12,2) not null default 0 check (shipping_cost >= 0),
  total                     numeric(12,2) not null default 0 check (total >= 0),
  payment_status            public.payment_status not null default 'pending',
  stripe_payment_intent_id  text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index idx_orders_user_id on public.orders(user_id);
create index idx_orders_status on public.orders(status);

create trigger trg_orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create table public.order_items (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  product_id  uuid references public.products(id) on delete set null,
  title       text not null,      -- snapshot: survives later product edits/deletion
  unit_price  numeric(12,2) not null check (unit_price >= 0),
  quantity    integer not null check (quantity > 0),
  created_at  timestamptz not null default now()
);

create index idx_order_items_order_id on public.order_items(order_id);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy "orders_select_own_or_admin"
  on public.orders for select
  using (auth.uid() = user_id or public.is_admin());

create policy "orders_insert_own"
  on public.orders for insert
  with check (auth.uid() = user_id);

create policy "orders_update_admin_only"
  on public.orders for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "order_items_select_own_or_admin"
  on public.order_items for select
  using (
    public.is_admin()
    or exists (select 1 from public.orders o where o.id = order_items.order_id and o.user_id = auth.uid())
  );

create policy "order_items_insert_own_or_admin"
  on public.order_items for insert
  with check (
    public.is_admin()
    or exists (select 1 from public.orders o where o.id = order_items.order_id and o.user_id = auth.uid())
  );

-- Saved payment method for off-session auction bidding, so a bidder isn't
-- asked to re-enter their card on every subsequent bid. Set the first time
-- one of their bids successfully authorizes (see lib/auctions/finalize-bid.ts).
alter table public.profiles
  add column default_payment_method_id text;

-- Atomic stock decrement, floor at zero. Called from the Stripe webhook once
-- an order's payment is captured — a plain UPDATE from application code
-- would work too, but wrapping it here keeps the floor-at-zero guarantee in
-- one place regardless of caller.
create or replace function public.decrement_product_stock(p_product_id uuid, p_quantity integer)
returns void
language sql
as $$
  update public.products
  set stock = greatest(stock - p_quantity, 0)
  where id = p_product_id;
$$;

-- ============================================================================
-- End of migration 0005_marketplace.sql
-- ============================================================================
