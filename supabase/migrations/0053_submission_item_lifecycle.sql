-- ============================================================================
-- Migration: 0053_submission_item_lifecycle.sql
--
-- Backs the Logistics Sorting Dashboard (/admin/logistics): tracks each
-- individual card's real physical location/stage, not just the coarser
-- submissions.status (0001_init_schema.sql: received/inspected/shipped/
-- graded/returned), which is one value per whole order. The two diverge on
-- purpose -- a single submission's cards don't necessarily travel together:
-- one card can go out in an earlier batch than its siblings, or a batch can
-- pull cards from several different submissions, which is exactly the
-- "packing individual client return boxes out of a shared incoming batch"
-- problem this dashboard exists to solve. That also means batch_id
-- belongs on submission_items (per card), not only on submissions
-- (0052_logistics_agent_schema.sql already added a submissions.batch_id --
-- that one is left in place as a whole-order default/convenience, but the
-- Return Splitter's actual queries key off this per-card one, which is the
-- authoritative link for cards that get split across batches).
--
-- Enum values keep the exact names given for this feature, in the casing
-- given, rather than this schema's usual lowercase_snake_case convention
-- (e.g. submission_status's 'received'/'inspected') -- they read as named
-- constants the admin UI and any future Logistics Agent will match against
-- literally, not prose.
-- ============================================================================

create type public.card_lifecycle_status as enum (
  'PENDING_INTAKE',
  'AT_HQ',
  'IN_GRADER_BATCH',
  'GRADING',
  'RETURNED_TO_HQ',
  'SHIPPED_TO_CLIENT'
);

alter table public.submission_items
  add column lifecycle_status public.card_lifecycle_status not null default 'PENDING_INTAKE',
  add column batch_id uuid references public.shipment_batches(id) on delete set null;

create index idx_submission_items_lifecycle_status on public.submission_items(lifecycle_status);
create index idx_submission_items_batch_id on public.submission_items(batch_id);

-- ============================================================================
-- End of migration 0053_submission_item_lifecycle.sql
-- ============================================================================
