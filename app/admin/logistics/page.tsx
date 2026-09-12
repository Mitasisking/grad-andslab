import { redirect } from 'next/navigation'
import { getSupabaseRouteClient } from '@/lib/supabase-route-client'
import { ReturnSplitter, type ReturnableBatch, type ReturnItem } from './return-splitter'
import type { ShippingAddress } from '@/lib/submission-types'

interface SubmissionItemRow {
  id: string
  card_name: string
  set_name: string
  grade_cert_number: string | null
  grade_result: number | null
  submissions: { user_id: string; shipping_address_snapshot: ShippingAddress | null } | { user_id: string; shipping_address_snapshot: ShippingAddress | null }[] | null
}

/**
 * Return Splitter (app/admin/logistics/return-splitter.tsx): picks a
 * shipment batch that has cards back from the grader and not yet sorted
 * (submission_items.lifecycle_status = 'RETURNED_TO_HQ'), groups them by the
 * client they belong to, and lets an admin check them off as physically
 * packed. See 0053_submission_item_lifecycle.sql for why batch_id/
 * lifecycle_status live on submission_items rather than submissions.
 */
export default async function AdminLogisticsPage({
  searchParams,
}: {
  searchParams: Promise<{ batch?: string }>
}) {
  const supabase = await getSupabaseRouteClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')

  const { batch: selectedBatchId } = await searchParams

  // Only batches with at least one card still waiting to be sorted are
  // worth showing in the picker -- a batch with nothing left in
  // RETURNED_TO_HQ has already been fully split into client boxes.
  const { data: returnedRows } = await supabase
    .from('submission_items')
    .select('batch_id')
    .eq('lifecycle_status', 'RETURNED_TO_HQ')
    .not('batch_id', 'is', null)

  const unsortedCounts = new Map<string, number>()
  for (const row of returnedRows ?? []) {
    if (!row.batch_id) continue
    unsortedCounts.set(row.batch_id, (unsortedCounts.get(row.batch_id) ?? 0) + 1)
  }
  const batchIds = Array.from(unsortedCounts.keys())

  let batches: ReturnableBatch[] = []
  if (batchIds.length > 0) {
    const { data: batchRows } = await supabase
      .from('shipment_batches')
      .select('id, grader, tracking_number, created_at')
      .in('id', batchIds)
      .order('created_at', { ascending: false })

    batches = (batchRows ?? []).map((b) => ({
      id: b.id,
      grader: b.grader,
      trackingNumber: b.tracking_number,
      createdAt: b.created_at,
      unsortedCount: unsortedCounts.get(b.id) ?? 0,
    }))
  }

  let items: ReturnItem[] = []
  if (selectedBatchId) {
    const { data: itemRows } = await supabase
      .from('submission_items')
      .select('id, card_name, set_name, grade_cert_number, grade_result, submissions(user_id, shipping_address_snapshot)')
      .eq('batch_id', selectedBatchId)
      .eq('lifecycle_status', 'RETURNED_TO_HQ')
      .order('card_name', { ascending: true })

    const rows = (itemRows ?? []) as SubmissionItemRow[]

    // Without generated Supabase types, a to-one embed (submission_items ->
    // submissions via submission_id) still infers as possibly-an-array --
    // it's a single row at runtime (app/auctions/new/page.tsx normalizes the
    // same embed the same way).
    const normalized = rows.map((r) => ({
      ...r,
      submission: Array.isArray(r.submissions) ? r.submissions[0] : r.submissions,
    }))

    const userIds = Array.from(new Set(normalized.map((r) => r.submission?.user_id).filter((id): id is string => Boolean(id))))

    // profiles has no email column (confirmed live against
    // information_schema -- it's drifted from 0001_init_schema.sql's
    // original definition), so full_name is the only client-name signal
    // available here; a submission with no name on file falls back to a
    // shortened id rather than a bare "Unknown client" for every such row.
    const { data: profileRows } =
      userIds.length > 0
        ? await supabase.from('profiles').select('id, full_name').in('id', userIds)
        : { data: [] as { id: string; full_name: string | null }[] }

    const profilesById = new Map((profileRows ?? []).map((p) => [p.id, p]))

    items = normalized.map((r) => {
      const clientProfile = r.submission?.user_id ? profilesById.get(r.submission.user_id) : undefined
      const shortId = r.submission?.user_id ? `Client ${r.submission.user_id.slice(0, 8)}` : 'Unknown client'
      return {
        id: r.id,
        cardName: r.card_name,
        setName: r.set_name,
        gradeCertNumber: r.grade_cert_number,
        gradeResult: r.grade_result,
        userId: r.submission?.user_id ?? null,
        clientName: clientProfile?.full_name || shortId,
        shippingAddress: r.submission?.shipping_address_snapshot ?? null,
      }
    })
  }

  return <ReturnSplitter batches={batches} selectedBatchId={selectedBatchId ?? null} items={items} />
}
