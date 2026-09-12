-- ============================================================================
-- Migration: 0052_logistics_agent_schema.sql
--
-- Schema-only groundwork for the planned Phase 2 Logistics Agent (monitors
-- orders, shipping, and submission batches for issues). No agent code lands
-- in this migration -- just the tables it will read from and write to, plus
-- the link from an existing submission to the batch it travels in.
--
-- shipment_batches groups multiple grading submissions.submissions
-- (0001_init_schema.sql) that physically ship to a grader together --
-- "bulk submissions to grading companies" is what submissions.batch_id
-- below links to, not app.orders (0005_marketplace.sql), which is this
-- app's unrelated shop/marketplace checkout table and has nothing to do
-- with grader shipments. grader reuses the existing public.grading_company
-- enum type (0001_init_schema.sql, extended by 0016/0021) rather than a new
-- one, restricted to ACE/PCG same as this request specified -- the two
-- graders submissions itself is actually restricted to today alongside PSA
-- (0023_allow_pcg_psa_ace_grading.sql; PSA is hidden site-wide per
-- components/dashboard/cert-link.tsx's own comment, so it's left out here).
--
-- status and severity are first-pass guesses, same situation this
-- codebase's own bulk-ace-import.tsx grading-scale comment already
-- describes for ACE's scale: no spec was given for either, so these are a
-- reasonable starting lifecycle/severity set to adjust once the actual
-- agent's real states are designed, not a claim that these are final.
-- ============================================================================

create type public.shipment_batch_status as enum (
  'preparing',
  'in_transit',
  'at_grader',
  'returning',
  'completed'
);

create type public.logistics_alert_severity as enum ('low', 'medium', 'critical');

create table public.shipment_batches (
  id                       uuid primary key default gen_random_uuid(),
  grader                   public.grading_company not null check (grader::text in ('ACE', 'PCG')),
  status                   public.shipment_batch_status not null default 'preparing',
  tracking_number          text,
  total_declared_value     numeric(12,2) not null default 0 check (total_declared_value >= 0),
  requires_customs_action  boolean not null default false,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index idx_shipment_batches_status on public.shipment_batches(status);
create index idx_shipment_batches_created_at on public.shipment_batches(created_at desc);

create trigger trg_shipment_batches_updated_at
  before update on public.shipment_batches
  for each row execute function public.set_updated_at();

create table public.logistics_alerts (
  id                 uuid primary key default gen_random_uuid(),
  batch_id           uuid not null references public.shipment_batches(id) on delete cascade,
  severity           public.logistics_alert_severity not null,
  issue_description  text not null,
  is_resolved        boolean not null default false,
  created_at         timestamptz not null default now()
);

create index idx_logistics_alerts_batch_id on public.logistics_alerts(batch_id);
create index idx_logistics_alerts_unresolved on public.logistics_alerts(is_resolved) where not is_resolved;

-- Links an existing grading submission to the batch it physically ships in.
-- Nullable + on delete set null: a submission is real and billable on its
-- own well before it's ever assigned to a shipped batch, and losing the
-- batch record later shouldn't take the submission down with it.
alter table public.submissions
  add column batch_id uuid references public.shipment_batches(id) on delete set null;

create index idx_submissions_batch_id on public.submissions(batch_id);

-- ----------------------------------------------------------------------------
-- RLS -- admin-only in every direction, same trust level as market_trends
-- (0050_market_trends.sql): internal operations data, never customer-facing.
-- No delete policy on either table for any session role -- a batch or an
-- alert is a record of something that actually happened, corrected via
-- status/is_resolved, not erased; only a service-role client (the future
-- agent) bypasses RLS entirely if it ever needs to.
-- ----------------------------------------------------------------------------
alter table public.shipment_batches enable row level security;

create policy "shipment_batches_select_admin_only"
  on public.shipment_batches for select
  using (public.is_admin());

create policy "shipment_batches_insert_admin_only"
  on public.shipment_batches for insert
  with check (public.is_admin());

create policy "shipment_batches_update_admin_only"
  on public.shipment_batches for update
  using (public.is_admin())
  with check (public.is_admin());

alter table public.logistics_alerts enable row level security;

create policy "logistics_alerts_select_admin_only"
  on public.logistics_alerts for select
  using (public.is_admin());

-- Marks an alert resolved -- this is an admin action even once the future
-- agent is the one creating alerts (that write goes through service-role,
-- like market_trends' inserts do, so it isn't gated by this insert policy).
create policy "logistics_alerts_insert_admin_only"
  on public.logistics_alerts for insert
  with check (public.is_admin());

create policy "logistics_alerts_update_admin_only"
  on public.logistics_alerts for update
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================================
-- End of migration 0052_logistics_agent_schema.sql
-- ============================================================================
