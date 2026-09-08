import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import type { PoolStatus } from '@/lib/submission-types'

interface Body {
  poolId: string
  status: PoolStatus
}

// Forward-only, matching the pool lifecycle open -> closed -> shipped ->
// completed (0035_submission_pools.sql). 'open' is never a valid target here
// since only assign_submission_pool() opens a pool, on insert.
const ALLOWED_TRANSITIONS: Record<PoolStatus, PoolStatus[]> = {
  open: ['closed'],
  closed: ['shipped'],
  shipped: ['completed'],
  completed: [],
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const { supabase } = auth

  const body = (await request.json()) as Body
  if (!body.poolId || !body.status) {
    return NextResponse.json({ error: 'poolId and status are required' }, { status: 400 })
  }

  const { data: pool, error: fetchError } = await supabase
    .from('pools')
    .select('id, status')
    .eq('id', body.poolId)
    .single()

  if (fetchError || !pool) {
    return NextResponse.json({ error: 'Pool not found' }, { status: 404 })
  }

  if (!ALLOWED_TRANSITIONS[pool.status as PoolStatus].includes(body.status)) {
    return NextResponse.json(
      { error: `Cannot move a ${pool.status} batch to ${body.status}` },
      { status: 400 },
    )
  }

  const patch: Record<string, unknown> = { status: body.status }
  if (body.status === 'closed') patch.closed_at = new Date().toISOString()
  if (body.status === 'shipped') patch.shipped_at = new Date().toISOString()

  const { data: updated, error } = await supabase
    .from('pools')
    .update(patch)
    .eq('id', body.poolId)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ pool: updated })
}
