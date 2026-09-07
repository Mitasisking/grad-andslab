import { NextRequest, NextResponse } from 'next/server'
import { getStripeClient } from '@/lib/stripe-server'
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
