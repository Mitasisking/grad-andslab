import { redirect } from 'next/navigation'
import { getSupabaseRouteClient } from '@/lib/supabase-route-client'
import { AdminPoolsBoard } from './pools-board'
import type { PoolRow } from '@/lib/submission-types'

export interface PoolSubmissionRow {
  id: string
  tier: string
  needs_clean_and_polish: boolean
  needs_semi_rigids: boolean
  interested_in_consignment: boolean
  created_at: string
  profiles: { full_name: string | null } | null
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

  // public.profiles has no foreign key relationship pointing at it anywhere
  // in production (confirmed directly against pg_constraint), so
  // PostgREST's `profiles(...)` embed syntax can never resolve here --
  // fetched as a separate batched lookup instead (see
  // lib/email/send-order-confirmation.ts's getContact for the same fix
  // applied to the confirmation-email path).
  const { data: submissions } = await supabase
    .from('submissions')
    .select('id, pool_id, user_id, tier, needs_clean_and_polish, needs_semi_rigids, interested_in_consignment, created_at')
    .not('pool_id', 'is', null)

  const userIds = Array.from(new Set((submissions ?? []).map((s) => s.user_id)))
  const { data: profiles } = userIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', userIds)
    : { data: [] as { id: string; full_name: string | null }[] }
  const fullNameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]))

  const submissionsByPool = new Map<string, PoolSubmissionRow[]>()
  for (const s of (submissions ?? []) as unknown as (Omit<PoolSubmissionRow, 'profiles'> & { pool_id: string; user_id: string })[]) {
    const row: PoolSubmissionRow = { ...s, profiles: { full_name: fullNameById.get(s.user_id) ?? null } }
    const list = submissionsByPool.get(s.pool_id) ?? []
    list.push(row)
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
