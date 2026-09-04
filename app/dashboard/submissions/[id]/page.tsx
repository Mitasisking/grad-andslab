import { notFound, redirect } from 'next/navigation'
import { getSupabaseRouteClient } from '@/lib/supabase-route-client'
import { SubmissionDetail } from './submission-detail'
import type { SubmissionRow, SubmissionItemRow } from '@/lib/submission-types'

export default async function SubmissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await getSupabaseRouteClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // RLS returns nothing for a submission that doesn't exist AND for one
  // that isn't the caller's own — notFound() covers both without leaking
  // which case it was.
  const { data: submission } = await supabase.from('submissions').select('*').eq('id', id).single()
  if (!submission) notFound()

  const { data: items } = await supabase
    .from('submission_items')
    .select('*')
    .eq('submission_id', id)
    .order('created_at', { ascending: true })

  return (
    <SubmissionDetail
      initialSubmission={submission as SubmissionRow}
      initialItems={(items ?? []) as SubmissionItemRow[]}
    />
  )
}
