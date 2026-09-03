import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getSupabaseServerClient } from '@/lib/supabase-server'
import { getStripeClient } from '@/lib/stripe-server'
import { finalizeAuthorizedBid } from '@/lib/auctions/finalize-bid'

export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature')
  const rawBody = await request.text()

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = getStripeClient().webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET as string)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid signature'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const supabase = getSupabaseServerClient()

  switch (event.type) {
    case 'payment_intent.succeeded':
    case 'payment_intent.payment_failed': {
      const intent = event.data.object as Stripe.PaymentIntent
      const succeeded = event.type === 'payment_intent.succeeded'

      if (intent.metadata.flow === 'grading_submission' && intent.metadata.submissionId) {
        await supabase
          .from('submissions')
          .update({
            payment_status: succeeded ? 'captured' : 'failed',
            stripe_payment_intent_id: intent.id,
          })
          .eq('id', intent.metadata.submissionId)
      }

      if (intent.metadata.flow === 'marketplace_order' && intent.metadata.orderId) {
        await supabase
          .from('orders')
          .update({
            status: succeeded ? 'paid' : 'cancelled',
            payment_status: succeeded ? 'captured' : 'failed',
            stripe_payment_intent_id: intent.id,
          })
          .eq('id', intent.metadata.orderId)

        // Stock is reserved by create_order() itself, at order-creation
        // time, not here (supabase/migrations/0009_stock_reservation.sql)
        // — a decline gives it back; success needs no further action since
        // it's already held.
        if (!succeeded) {
          await supabase.rpc('release_order_stock', { p_order_id: intent.metadata.orderId })
        }
      }
      break
    }

    // Fires when a manual-capture PaymentIntent (an auction bid hold)
    // becomes authorized. This is the source of truth for a bid actually
    // landing on the first-time-bidder / 3DS path, where the client only
    // confirms the payment method — it doesn't itself write the bid row.
    case 'payment_intent.amount_capturable_updated': {
      const intent = event.data.object as Stripe.PaymentIntent
      if (intent.metadata.flow === 'auction_bid') {
        await finalizeAuthorizedBid(intent)
      }
      break
    }

    default:
      break
  }

  return NextResponse.json({ received: true })
}
