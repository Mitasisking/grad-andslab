import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase-server'

const RESERVATION_MINUTES = 30

/**
 * Releases stock reserved by create_order() for carts that never got paid —
 * the marketplace counterpart to app/api/auctions/close/route.ts (something
 * was held against an outcome that never happened). A failed/declined
 * payment already gets released by the Payfast ITN webhook the moment it
 * fires; this covers the case where no payment attempt ever happens at
 * all — the customer just abandons checkout, so no ITN ever arrives.
 *
 * Orders still 'pending' more than RESERVATION_MINUTES after creation are
 * treated as abandoned: their stock is released and they're marked
 * 'cancelled'. Cron-invoked, not user-facing — same CRON_SECRET pattern as
 * /api/auctions/close. Call it every few minutes (Supabase pg_cron or an
 * external scheduler) with `Authorization: Bearer <CRON_SECRET>`.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServerClient()
  const cutoff = new Date(Date.now() - RESERVATION_MINUTES * 60 * 1000).toISOString()

  // A separate select-then-act (the previous shape here) leaves a real race
  // window open: if the Payfast ITN webhook marks an order 'paid' between
  // this route's read and its later write, the old code released that
  // order's stock and stamped it 'cancelled'/'failed' anyway, clobbering a
  // legitimately completed sale and oversell-ing the item. Folding the
  // status/cutoff check into the UPDATE itself closes that window: it only
  // ever touches rows that are STILL 'pending' at the moment this exact
  // statement runs, so a webhook (or a second overlapping cron invocation)
  // that already moved an order off 'pending' makes it invisible to this
  // query, not just stale data from an earlier read.
  const { data: staleOrders } = await supabase
    .from('orders')
    .update({ status: 'cancelled', payment_status: 'failed' })
    .eq('status', 'pending')
    .lt('created_at', cutoff)
    .select('id')

  for (const order of staleOrders ?? []) {
    await supabase.rpc('release_order_stock', { p_order_id: order.id })
  }

  return NextResponse.json({ released: staleOrders?.length ?? 0 })
}
