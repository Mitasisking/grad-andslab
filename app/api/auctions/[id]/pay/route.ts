import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRouteClient } from '@/lib/supabase-route-client'
import { createPayfastCheckoutUrl } from '@/lib/payments/payfast'

/**
 * Generates the Payfast redirect for an auction's winning invoice — the
 * step that replaces Stripe's hold-capture (app/api/auctions/close/route.ts
 * used to just capture the already-authorized PaymentIntent; Payfast has no
 * such hold, so the winner pays here, after the fact, once the auction has
 * actually closed). The winning bid row itself IS the invoice: its
 * `payment_status` starts 'pending' and this doesn't touch it — the Payfast
 * ITN webhook (app/api/webhooks/payfast/route.ts) is the only thing allowed
 * to mark it paid, once Payfast actually confirms the payment.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await getSupabaseRouteClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: auction, error: auctionError } = await supabase
    .from('auctions')
    .select('id, title, status, reserve_price, current_high_bid, current_high_bidder_id')
    .eq('id', id)
    .single()

  if (auctionError || !auction) {
    return NextResponse.json({ error: 'Auction not found' }, { status: 404 })
  }
  if (auction.status !== 'closed') {
    return NextResponse.json({ error: 'This auction has not closed yet' }, { status: 400 })
  }
  if (auction.current_high_bidder_id !== user.id) {
    return NextResponse.json({ error: 'Only the winning bidder can pay this invoice' }, { status: 403 })
  }
  const reserveMet =
    auction.current_high_bid !== null &&
    (auction.reserve_price === null || Number(auction.current_high_bid) >= Number(auction.reserve_price))
  if (!reserveMet) {
    return NextResponse.json({ error: 'The reserve price was not met — nothing to pay' }, { status: 400 })
  }

  const { data: winningBid } = await supabase
    .from('bids')
    .select('id, amount, payment_status')
    .eq('auction_id', auction.id)
    .eq('bidder_id', user.id)
    .order('amount', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!winningBid) {
    return NextResponse.json({ error: 'Could not find your winning bid' }, { status: 404 })
  }
  if (winningBid.payment_status === 'captured') {
    return NextResponse.json({ error: 'This invoice has already been paid' }, { status: 400 })
  }

  const origin = request.headers.get('origin') ?? new URL(request.url).origin
  const redirectUrl = createPayfastCheckoutUrl({
    mPaymentId: winningBid.id,
    amount: Number(winningBid.amount),
    itemName: `Cuppa Cards auction win — ${auction.title}`,
    emailAddress: user.email,
    returnUrl: `${origin}/auctions/${auction.id}?paid=true`,
    cancelUrl: `${origin}/auctions/${auction.id}?canceled=true`,
    notifyUrl: `${origin}/api/webhooks/payfast`,
    flow: 'auction_invoice',
  })

  return NextResponse.json({ redirectUrl })
}
