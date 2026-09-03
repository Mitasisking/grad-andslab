import { NextRequest, NextResponse } from 'next/server'
import { getStripeClient } from '@/lib/stripe-server'

interface CheckoutBody {
  amountCents: number
  submissionId: string
  customerId?: string
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as CheckoutBody

  if (!Number.isFinite(body.amountCents) || body.amountCents < 50) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
  }
  if (!body.submissionId) {
    return NextResponse.json({ error: 'submissionId is required' }, { status: 400 })
  }

  const intent = await getStripeClient().paymentIntents.create({
    amount: Math.round(body.amountCents),
    currency: 'usd',
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
