import type { SupabaseClient } from '@supabase/supabase-js'
import type { PoolRow } from '@/lib/submission-types'

const ACTIVE_POOL_COLUMNS = 'id, grading_company, tier, label, capacity, current_count, status'

/**
 * Public, read-only snapshot of currently-filling batches for /submit's
 * top-of-page Live Batch Tracker (components/grading/LiveBatchTracker.tsx,
 * mounted from app/submit/wizard.tsx when app/submit/page.tsx's
 * SHOW_BATCH_TRACKER flag is on). No new API surface needed:
 * supabase/migrations/0035_submission_pools.sql already grants
 * `pools_select_all` (using (true)) since pools carry no customer PII, the
 * same RLS grant components/PoolTracker.tsx's client-side realtime view
 * already relies on -- this just reads the same table server-side for a
 * one-shot render instead of a live-updating widget.
 *
 * Scoped to PCG/ACE only, matching the site's "Official PCG and ACE
 * Middleman" copy -- PSA is not currently an active grading partner, so a
 * stray PSA pool (if one ever exists) shouldn't surface here even though
 * public.grading_company still allows the value at the schema level.
 */
// PCG (4 tiers) + ACE (3 tiers) means at most 7 distinct open pools can
// exist at once today -- one per (company, tier) pair, per
// assign_submission_pool()'s own logic in 0035_submission_pools.sql. 12
// leaves headroom without ever truncating the real set.
export async function getActiveLivePools(supabase: SupabaseClient, limit = 12): Promise<PoolRow[]> {
  const { data, error } = await supabase
    .from('pools')
    .select(ACTIVE_POOL_COLUMNS)
    .eq('status', 'open')
    .in('grading_company', ['PCG', 'ACE'])
    .order('opened_at', { ascending: true })
    .limit(limit)

  if (error) {
    console.error('Active pools query failed', error.message)
    return []
  }

  return (data ?? []) as PoolRow[]
}
