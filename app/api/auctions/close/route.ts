import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase-server'
import { getStripeClient } from '@/lib/stripe-server'

/**
 * Settles auctions whose ends_at has passed: captures the winning bid's
 * held PaymentIntent (or releases every hold if the reserve wasn't met, or
 * there were no bids), and cancels every other authorized hold on that
 * auction.
 *
 * This route has no user session of its own — it's meant to be invoked by
 * a scheduled trigger (Supabase pg_cron calling this URL, or an external
 * cron) rather than a browser, so it's protected by a shared secret instead
 * of requireAdmin(). Set CRON_SECRET and call with
 * `Authorization: Bearer <CRON_SECRET>`.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServerClient()
  const stripe = getStripeClient()

  const { data: dueAuctions } = await supabase
    .from('auctions')
    .select('*')
    .in('status', ['active', 'extended'])
    .lte('ends_at', new Date().toISOString())

  const results = []

  for (const auction of dueAuctions ?? []) {
    const reserveMet =
      auction.current_high_bid !== null &&
      (auction.reserve_price === null || Number(auction.current_high_bid) >= Number(auction.reserve_price))

    const { data: authorizedBids } = await supabase
      .from('bids')
      .select('*')
      .eq('auction_id', auction.id)
      .eq('payment_status', 'authorized')

    for (const bid of authorizedBids ?? []) {
      const isWinner = reserveMet && bid.bidder_id === auction.current_high_bidder_id
      try {
        if (isWinner && bid.stripe_payment_intent_id) {
          await stripe.paymentIntents.capture(bid.stripe_payment_intent_id)
          await supabase.from('bids').update({ payment_status: 'captured' }).eq('id', bid.id)
        } else if (bid.stripe_payment_intent_id) {
          await stripe.paymentIntents.cancel(bid.stripe_payment_intent_id)
          await supabase.from('bids').update({ payment_status: 'refunded' }).eq('id', bid.id)
        }
      } catch {
        // Hold may have already expired or been released on Stripe's side;
        // continue closing out the remaining bids rather than aborting.
      }
    }

    await supabase.from('auctions').update({ status: 'closed' }).eq('id', auction.id)

    results.push({
      auctionId: auction.id,
      reserveMet,
      winnerId: reserveMet ? auction.current_high_bidder_id : null,
    })
  }

  return NextResponse.json({ closed: results.length, results })
}
