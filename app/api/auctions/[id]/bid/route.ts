import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRouteClient } from '@/lib/supabase-route-client'
import { getSupabaseServerClient } from '@/lib/supabase-server'
import { formatZAR } from '@/lib/currency'

interface Body {
  amount: number
}

interface AuctionBidResult {
  became_high_bid: boolean
  previous_high_bidder_id: string | null
  previous_high_bid_amount: number | null
}

/**
 * Places a bid directly — no payment hold. Auctions moved off Stripe (which
 * used a manual-capture PaymentIntent as a pre-authorization hold per bid,
 * released on the fly whenever someone was outbid) to Payfast, which has no
 * equivalent hold/pre-auth primitive; only the eventual *winner* pays,
 * via the invoice generated once the auction closes
 * (app/api/auctions/close/route.ts, app/api/auctions/[id]/pay/route.ts).
 * So placing a bid is now just a validated, race-safe database write.
 *
 * Bidders still can't INSERT into public.bids directly (no bids_insert_own
 * policy exists — see supabase/migrations/0007_rls_hardening.sql's own
 * removal of that exact policy as a fix for an insecure direct-insert path):
 * the floor/ended/self-bid checks below only run once, here, so a client
 * writing straight to the table could skip them. This route uses the
 * service-role client to perform the actual write after re-validating
 * everything itself.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await getSupabaseRouteClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = (await request.json()) as Body
  if (!Number.isFinite(body.amount) || body.amount <= 0) {
    return NextResponse.json({ error: 'A valid bid amount is required' }, { status: 400 })
  }

  const { data: auction, error: auctionError } = await supabase
    .from('auctions')
    .select('id, seller_id, status, ends_at, current_high_bid, bid_increment, starting_price')
    .eq('id', id)
    .single()

  if (auctionError || !auction) {
    return NextResponse.json({ error: 'Auction not found' }, { status: 404 })
  }
  if (auction.status === 'closed' || new Date(auction.ends_at) <= new Date()) {
    return NextResponse.json({ error: 'This auction has ended' }, { status: 400 })
  }
  if (auction.seller_id === user.id) {
    return NextResponse.json({ error: "You can't bid on your own listing" }, { status: 400 })
  }

  const floor = auction.current_high_bid
    ? Number(auction.current_high_bid) + Number(auction.bid_increment)
    : Number(auction.starting_price)

  if (body.amount < floor) {
    return NextResponse.json({ error: `Bid must be at least ${formatZAR(floor)}` }, { status: 400 })
  }

  const serviceClient = getSupabaseServerClient()

  const { data: bid, error: insertError } = await serviceClient
    .from('bids')
    .insert({ auction_id: auction.id, bidder_id: user.id, amount: body.amount })
    .select('id, auction_id, bidder_id, amount, payment_status, created_at')
    .single()

  if (insertError || !bid) {
    console.error('Could not record bid', auction.id, insertError?.message)
    return NextResponse.json({ error: 'Could not place bid' }, { status: 500 })
  }

  // Atomic under the hood (supabase/migrations/0045_fix_auction_bid_race_
  // condition.sql locks the auctions row with `for update` before deciding)
  // -- two bids landing close to the same instant can't both "win" the
  // current_high_bid update.
  const { data: bidResultRow } = await serviceClient
    .rpc('record_auction_bid_result', {
      p_auction_id: auction.id,
      p_bidder_id: user.id,
      p_amount: body.amount,
    })
    .single()
  const bidResult = bidResultRow as AuctionBidResult | null

  return NextResponse.json({ bid, becameHighBid: bidResult?.became_high_bid ?? false })
}
