import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getSupabaseRouteClient } from '@/lib/supabase-route-client'
import { getSupabaseServerClient } from '@/lib/supabase-server'
import { getStripeClient } from '@/lib/stripe-server'
import { finalizeAuthorizedBid } from '@/lib/auctions/finalize-bid'

interface Body {
  amount: number
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const stripe = getStripeClient()
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
    .select('*')
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
    return NextResponse.json({ error: `Bid must be at least $${floor.toFixed(2)}` }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id, default_payment_method_id, email, full_name')
    .eq('id', user.id)
    .single()

  let customerId = profile?.stripe_customer_id ?? null
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: profile?.email ?? user.email ?? undefined,
      name: profile?.full_name ?? undefined,
      metadata: { userId: user.id },
    })
    customerId = customer.id
    // stripe_customer_id is system-controlled as of
    // supabase/migrations/0010_rls_hardening_low.sql — the bidder's own
    // session client can no longer write it, even though this value is
    // legitimately theirs, so this one write uses the service-role client
    // instead (same trust category as finalizeAuthorizedBid's writes).
    await getSupabaseServerClient().from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id)
  }

  const amountCents = Math.round(body.amount * 100)

  // Returning bidder with a saved card: place the hold off-session — no
  // client confirmation needed for a routine bid.
  if (profile?.default_payment_method_id) {
    try {
      const intent = await stripe.paymentIntents.create({
        amount: amountCents,
        currency: 'usd',
        customer: customerId,
        payment_method: profile.default_payment_method_id,
        capture_method: 'manual',
        off_session: true,
        confirm: true,
        metadata: { flow: 'auction_bid', auctionId: auction.id, bidderId: user.id },
      })

      if (intent.status === 'requires_capture') {
        const bid = await finalizeAuthorizedBid(intent)
        return NextResponse.json({ requiresAction: false, bid })
      }
      // Any other resulting status (e.g. requires_action for 3DS) falls
      // through to the same client-confirmation response as a first-time
      // bidder, using this same intent's client_secret.
      return NextResponse.json({ requiresAction: true, clientSecret: intent.client_secret })
    } catch (err) {
      // The saved card may have declined off-session (common when the
      // issuer wants interactive 3DS) — fall back to on-session confirmation
      // instead of failing the bid outright.
      const stripeErr = err as Stripe.errors.StripeError
      if (stripeErr.payment_intent?.client_secret) {
        return NextResponse.json({ requiresAction: true, clientSecret: stripeErr.payment_intent.client_secret })
      }
      return NextResponse.json({ error: stripeErr.message ?? 'Could not place bid' }, { status: 402 })
    }
  }

  // First-time bidder (or no saved method yet): create the hold and ask the
  // client to confirm it, saving the payment method for next time.
  const intent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: 'usd',
    customer: customerId,
    capture_method: 'manual',
    setup_future_usage: 'off_session',
    automatic_payment_methods: { enabled: true },
    metadata: { flow: 'auction_bid', auctionId: auction.id, bidderId: user.id },
  })

  return NextResponse.json({ requiresAction: true, clientSecret: intent.client_secret })
}
