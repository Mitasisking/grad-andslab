import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase-server'

const RESERVATION_MINUTES = 30

/**
 * Releases stock reserved by create_order() for carts that never got paid —
 * the marketplace counterpart to app/api/auctions/close/route.ts (something
 * was held against an outcome that never happened). A failed/declined
 * payment already gets released by the Stripe webhook the moment it fires;
 * this covers the case where no payment attempt ever happens at all — the
 * customer just abandons checkout, so no Stripe event exists to react to.
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

  const { data: staleOrders } = await supabase
    .from('orders')
    .select('id')
    .eq('status', 'pending')
    .lt('created_at', cutoff)

  for (const order of staleOrders ?? []) {
    await supabase.rpc('release_order_stock', { p_order_id: order.id })
    await supabase.from('orders').update({ status: 'cancelled', payment_status: 'failed' }).eq('id', order.id)
  }

  return NextResponse.json({ released: staleOrders?.length ?? 0 })
}
