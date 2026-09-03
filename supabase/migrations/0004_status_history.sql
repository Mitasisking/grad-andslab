-- ============================================================================
-- Migration: 0004_status_history.sql
-- Adds an audit trail table for submission status transitions. Backs the
-- admin status override (jumping stages, moving backward) with a required
-- reason on record, and also logs the initial 'received' state at order
-- creation time for a complete history.
-- ============================================================================

create table public.submission_status_log (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  from_status   public.submission_status,
  to_status     public.submission_status not null,
  changed_by    uuid not null references public.profiles(id),
  reason        text,
  created_at    timestamptz not null default now()
);

create index idx_submission_status_log_submission_id
  on public.submission_status_log(submission_id, created_at);

alter table public.submission_status_log enable row level security;

-- Admins can see every transition; customers can see the history of their
-- own submissions (read-only, for transparency).
create policy "status_log_select_own_or_admin"
  on public.submission_status_log for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.submissions s
      where s.id = submission_status_log.submission_id and s.user_id = auth.uid()
    )
  );

-- Admins can log any transition (routine advances and overrides alike).
-- The submission owner may also insert — needed only for the single
-- 'received' entry written at order-creation time in /api/submissions.
create policy "status_log_insert_admin_or_owner"
  on public.submission_status_log for insert
  with check (
    public.is_admin()
    or exists (
      select 1 from public.submissions s
      where s.id = submission_status_log.submission_id and s.user_id = auth.uid()
    )
  );

-- ============================================================================
-- End of migration 0004_status_history.sql
-- ============================================================================
