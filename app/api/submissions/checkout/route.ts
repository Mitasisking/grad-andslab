import { NextRequest, NextResponse } from 'next/server'
import { getStripeClient } from '@/lib/stripe-server'
import { getSupabaseRouteClient } from '@/lib/supabase-route-client'
import { createPayfastCheckoutUrl } from '@/lib/payments/payfast'
import { REGION_CURRENCY } from '@/lib/shop/product-type'

const VALID_CURRENCIES = new Set(Object.values(REGION_CURRENCY))

interface CheckoutBody {
  amountCents: number
  submissionId: string
  currency: 'usd' | 'gbp' | 'zar'
  customerId?: string
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as CheckoutBody

  // Stripe's minimum charge is currency-specific; USD's is roughly $0.50 (50
  // minor units). Rounded up generously here since this is a rough safety
  // net, not sourced from Stripe's own published minimums for this account
  // -- verify against the Stripe dashboard if a legitimately small
  // submission ever gets rejected at this check.
  if (!Number.isFinite(body.amountCents) || body.amountCents < 100) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
  }
  if (!body.submissionId) {
    return NextResponse.json({ error: 'submissionId is required' }, { status: 400 })
  }
  if (!body.currency || !VALID_CURRENCIES.has(body.currency)) {
    return NextResponse.json({ error: 'A valid currency is required' }, { status: 400 })
  }

  // SA storefront routes through Payfast (ZAR-only) instead of Stripe --
  // currency is a reliable stand-in for region here since REGION_CURRENCY
  // maps 'zar' only to region 'sa' (lib/shop/product-type.ts). Everything
  // else (UK/USA) is unchanged below.
  if (body.currency === 'zar') {
    const supabase = await getSupabaseRouteClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { data: submission } = await supabase
      .from('submissions')
      .select('id, shipping_address_snapshot')
      .eq('id', body.submissionId)
      .eq('user_id', user.id)
      .single()

    if (!submission) {
      return NextResponse.json({ error: 'Submission not found for this account' }, { status: 400 })
    }

    const addressName = (submission.shipping_address_snapshot as { name?: string } | null)?.name ?? ''
    const [nameFirst, ...rest] = addressName.split(' ')

    const origin = request.headers.get('origin') ?? new URL(request.url).origin
    const redirectUrl = createPayfastCheckoutUrl({
      mPaymentId: body.submissionId,
      amount: body.amountCents / 100,
      itemName: `Cuppa Cards grading submission #${body.submissionId.slice(0, 8).toUpperCase()}`,
      nameFirst: nameFirst || undefined,
      nameLast: rest.join(' ') || undefined,
      emailAddress: user.email,
      returnUrl: `${origin}/dashboard/submissions/${body.submissionId}?success=true`,
      cancelUrl: `${origin}/submit?canceled=true`,
      notifyUrl: `${origin}/api/webhooks/payfast`,
      flow: 'grading_submission',
    })
    return NextResponse.json({ redirectUrl })
  }

  const intent = await getStripeClient().paymentIntents.create({
    amount: Math.round(body.amountCents),
    currency: body.currency,
    customer: body.customerId,
    // Submission fees are captured immediately on payment. This differs from
    // auction bid pre-authorization (Phase 4), which uses capture_method: 'manual'.
    capture_method: 'automatic',
    automatic_payment_methods: { enabled: true },
    metadata: {
      submissionId: body.submissionId,
      flow: 'grading_submission',
    },
  })

  return NextResponse.json({ clientSecret: intent.client_secret })
}
