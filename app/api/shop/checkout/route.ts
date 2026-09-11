import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRouteClient } from '@/lib/supabase-route-client'
import { createPayfastCheckoutUrl } from '@/lib/payments/payfast'

interface Body {
  orderId: string
}

/**
 * Creates the Payfast redirect for a marketplace order. Payfast is now the
 * only processor this app talks to (see lib/payments/payfast.ts) — the
 * former Stripe/Payfast region split (SA -> Payfast, UK/USA -> Stripe) is
 * gone along with Stripe itself, since the storefront only ever sells in SA
 * now (app/shop/page.tsx). The charge amount comes from orders.total,
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
    .select('id, total, payment_status')
    .eq('id', body.orderId)
    .eq('user_id', user.id)
    .single()

  if (error || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }
  if (order.payment_status !== 'pending') {
    return NextResponse.json({ error: 'This order has already been paid or is no longer payable' }, { status: 400 })
  }

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
