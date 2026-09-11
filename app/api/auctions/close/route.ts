import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase-server'
import { sendAuctionWonEmail } from '@/lib/email/send-order-confirmation'

/**
 * Settles auctions whose ends_at has passed. No payment happens here —
 * Payfast (this app's only processor since Stripe was removed) has no
 * hold/capture primitive to reconcile the way the old Stripe flow did.
 * Instead this just decides the outcome and leaves an invoice for the
 * winner to pay: current_high_bidder_id is already the winner (set
 * incrementally by record_auction_bid_result as bids came in), so closing
 * an auction is just flipping its status and, if the reserve was met,
 * emailing that bidder a link to pay via app/api/auctions/[id]/pay.
 *
 * This route has no user session of its own — it's meant to be invoked by
 * a scheduled trigger (Supabase pg_cron calling this URL) rather than a
 * browser, so it's protected by a shared secret instead of requireAdmin().
 * Set CRON_SECRET and call with `Authorization: Bearer <CRON_SECRET>`.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServerClient()

  const { data: dueAuctions } = await supabase
    .from('auctions')
    .select('id, reserve_price, current_high_bid, current_high_bidder_id')
    .in('status', ['active', 'extended'])
    .lte('ends_at', new Date().toISOString())

  const results = []

  for (const auction of dueAuctions ?? []) {
    const reserveMet =
      auction.current_high_bid !== null &&
      (auction.reserve_price === null || Number(auction.current_high_bid) >= Number(auction.reserve_price))

    await supabase.from('auctions').update({ status: 'closed' }).eq('id', auction.id)

    if (reserveMet && auction.current_high_bidder_id) {
      sendAuctionWonEmail(auction.id).catch((err) =>
        console.error('Could not send auction-won email', auction.id, err),
      )
    }

    results.push({
      auctionId: auction.id,
      reserveMet,
      winnerId: reserveMet ? auction.current_high_bidder_id : null,
    })
  }

  return NextResponse.json({ closed: results.length, results })
}
