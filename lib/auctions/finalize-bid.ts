import type Stripe from 'stripe'
import { getSupabaseServerClient } from '@/lib/supabase-server'
import { getStripeClient } from '@/lib/stripe-server'

/**
 * Finalizes a bid once its PaymentIntent hold is authorized
 * (status: 'requires_capture'). Called from two places:
 *   1. Immediately after an off-session confirm succeeds (returning bidder,
 *      saved card) in app/api/auctions/[id]/bid/route.ts.
 *   2. From the Stripe webhook, when an on-session client confirm succeeds
 *      (first-time bidder or a card that needed 3DS).
 * Both can fire for the same PaymentIntent, so this is idempotent on
 * stripe_payment_intent_id — a duplicate call is an expected race, not
 * an error, and returns the already-created bid rather than erroring.
 *
 * Uses the service-role client rather than any caller-supplied session
 * client: updating auctions.current_high_bid is legitimately outside what
 * a bidder's own RLS permissions allow (only the seller/admin can write to
 * auctions per Phase 1's policy) — this function is a trusted system
 * reconciliation of Stripe's authoritative state, the same category of
 * operation as the payment webhooks elsewhere in this app.
 */
export async function finalizeAuthorizedBid(intent: Stripe.PaymentIntent) {
  const auctionId = intent.metadata.auctionId
  const bidderId = intent.metadata.bidderId
  if (!auctionId || !bidderId) return null

  const supabase = getSupabaseServerClient()
  const stripe = getStripeClient()

  const { data: existing } = await supabase
    .from('bids')
    .select('id')
    .eq('stripe_payment_intent_id', intent.id)
    .maybeSingle()

  if (existing) return existing // already finalized by the other caller

  const amount = intent.amount / 100

  const { data: auction } = await supabase
    .from('auctions')
    .select('id, current_high_bid, current_high_bidder_id')
    .eq('id', auctionId)
    .single()

  if (!auction) return null

  // Save the payment method for future off-session bids, if not already saved.
  if (intent.payment_method) {
    await supabase
      .from('profiles')
      .update({ default_payment_method_id: intent.payment_method as string })
      .eq('id', bidderId)
      .is('default_payment_method_id', null)
  }

  const { data: bid } = await supabase
    .from('bids')
    .insert({
      auction_id: auctionId,
      bidder_id: bidderId,
      amount,
      stripe_payment_intent_id: intent.id,
      payment_status: 'authorized',
    })
    .select('*')
    .single()

  // Release the previous highest bidder's hold now that they've been outbid.
  const previousHighBidderId = auction.current_high_bidder_id
  if (previousHighBidderId && previousHighBidderId !== bidderId) {
    const { data: previousBid } = await supabase
      .from('bids')
      .select('stripe_payment_intent_id')
      .eq('auction_id', auctionId)
      .eq('bidder_id', previousHighBidderId)
      .eq('payment_status', 'authorized')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (previousBid?.stripe_payment_intent_id) {
      try {
        await stripe.paymentIntents.cancel(previousBid.stripe_payment_intent_id)
        // Reusing 'refunded' from the payment_status enum to mean "hold
        // released" — no capture ever happened, but it's the closest
        // available state to "this bidder is no longer on the hook."
        await supabase
          .from('bids')
          .update({ payment_status: 'refunded' })
          .eq('stripe_payment_intent_id', previousBid.stripe_payment_intent_id)
      } catch {
        // Already canceled or captured on Stripe's side; nothing to release.
      }
    }
  }

  if (!auction.current_high_bid || amount > Number(auction.current_high_bid)) {
    await supabase
      .from('auctions')
      .update({ current_high_bid: amount, current_high_bidder_id: bidderId })
      .eq('id', auctionId)
  }

  return bid
}
