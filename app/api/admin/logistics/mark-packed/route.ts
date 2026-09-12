import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'

interface MarkPackedBody {
  itemIds?: string[]
}

/**
 * Backs the Return Splitter's "Mark as Packed" button
 * (app/admin/logistics/return-splitter.tsx): flips a specific client's
 * checked-off cards from RETURNED_TO_HQ to SHIPPED_TO_CLIENT in one request,
 * once the admin has physically packed that client's box. Runs under the
 * caller's own session (requireAdmin's client) -- submission_items_update_
 * admin_only (0007_rls_hardening.sql) is the actual gate, same as every
 * other session-scoped admin route in this app.
 *
 * Only ever moves a row OUT of RETURNED_TO_HQ, never into it from anywhere
 * else -- the .eq('lifecycle_status', 'RETURNED_TO_HQ') guard means a stale
 * client (e.g. two admin tabs open on the same batch) can't accidentally
 * re-ship a card that was already marked shipped, or one that never
 * actually made it back from the grader.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const { supabase } = auth

  const body = (await request.json()) as MarkPackedBody
  if (!Array.isArray(body.itemIds) || body.itemIds.length === 0) {
    return NextResponse.json({ error: 'itemIds is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('submission_items')
    .update({ lifecycle_status: 'SHIPPED_TO_CLIENT' })
    .in('id', body.itemIds)
    .eq('lifecycle_status', 'RETURNED_TO_HQ')
    .select('id')

  if (error) {
    console.error('mark-packed update failed:', error.message)
    return NextResponse.json({ error: 'Could not update card statuses' }, { status: 500 })
  }

  return NextResponse.json({ updated: data.length })
}
