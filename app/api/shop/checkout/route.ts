import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRouteClient } from '@/lib/supabase-route-client'
import { getStripeClient } from '@/lib/stripe-server'
import { createPayfastCheckoutUrl } from '@/lib/payments/payfast'
import { REGION_CURRENCY } from '@/lib/shop/product-type'

interface Body {
  orderId: string
}

/**
 * Creates the PaymentIntent for a marketplace order — automatic capture,
 * like grading fees (app/api/submissions/checkout/route.ts), unlike auction
 * bids' manual-capture holds. The charge amount comes from orders.total,
 * looked up here — the client only ever supplies which order to pay for,
 * never an amount.
 */
export async function POST(request: NextRequest) {
  const supabase = await getSupabaseRouteClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = (await request.json()) as Body
  if (!body.orderId) {
    return NextResponse.json({ error: 'orderId is required' }, { status: 400 })
  }

  const { data: order, error } = await supabase
    .from('orders')
    .select('id, total, payment_status, region')
    .eq('id', body.orderId)
    .eq('user_id', user.id)
    .single()

  if (error || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }
  if (order.payment_status !== 'pending') {
    return NextResponse.json({ error: 'This order has already been paid or is no longer payable' }, { status: 400 })
  }

  // SA storefront routes through Payfast (ZAR-only, the same currency
  // REGION_CURRENCY.sa already resolves to) instead of Stripe -- everything
  // else (UK/USA) is unchanged below.
  if (order.region === 'sa') {
    const origin = request.headers.get('origin') ?? new URL(request.url).origin
    const redirectUrl = createPayfastCheckoutUrl({
      mPaymentId: order.id,
      amount: Number(order.total),
      itemName: `Cuppa Cards order #${order.id.slice(0, 8).toUpperCase()}`,
      emailAddress: user.email,
      returnUrl: `${origin}/shop?success=true&orderId=${order.id}`,
      cancelUrl: `${origin}/shop?canceled=true`,
      notifyUrl: `${origin}/api/webhooks/payfast`,
      flow: 'marketplace_order',
    })
    return NextResponse.json({ redirectUrl })
  }

  const intent = await getStripeClient().paymentIntents.create({
    amount: Math.round(Number(order.total) * 100),
    currency: REGION_CURRENCY[order.region as keyof typeof REGION_CURRENCY],
    capture_method: 'automatic',
    automatic_payment_methods: { enabled: true },
    metadata: {
      orderId: order.id,
      flow: 'marketplace_order',
    },
  })

  return NextResponse.json({ clientSecret: intent.client_secret })
}
