import { redirect } from 'next/navigation'
import { getSupabaseRouteClient } from '@/lib/supabase-route-client'
import { AdminPoolsBoard } from './pools-board'
import type { PoolRow } from '@/lib/submission-types'

export interface PoolSubmissionRow {
  id: string
  tier: string
  needs_clean_and_polish: boolean
  created_at: string
  profiles: { full_name: string | null; email: string } | null
}

export default async function AdminPoolsPage() {
  const supabase = await getSupabaseRouteClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')

  const { data: pools } = await supabase
    .from('pools')
    .select('*')
    .order('status', { ascending: true })
    .order('opened_at', { ascending: false })

  const { data: submissions } = await supabase
    .from('submissions')
    .select('id, pool_id, tier, needs_clean_and_polish, created_at, profiles(full_name, email)')
    .not('pool_id', 'is', null)

  const submissionsByPool = new Map<string, PoolSubmissionRow[]>()
  for (const s of (submissions ?? []) as unknown as (PoolSubmissionRow & { pool_id: string })[]) {
    const list = submissionsByPool.get(s.pool_id) ?? []
    list.push(s)
    submissionsByPool.set(s.pool_id, list)
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <p className="text-[13px]" style={{ color: 'var(--ink-muted)' }}>
        Admin
      </p>
      <h1 className="text-[28px] mt-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
        Batches
      </h1>
      <p className="text-[13.5px] mt-2 max-w-2xl" style={{ color: 'var(--ink-muted)' }}>
        Every submission is dropped into an open batch for its grading company + tier automatically
        (supabase/migrations/0035_submission_pools.sql). A batch closes itself once it hits capacity; advancing it
        to shipped/completed here is a manual step and cascades to every submission inside.
      </p>

      <AdminPoolsBoard pools={(pools ?? []) as PoolRow[]} submissionsByPool={Object.fromEntries(submissionsByPool)} />
    </main>
  )
}
