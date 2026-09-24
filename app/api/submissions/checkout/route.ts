import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRouteClient } from '@/lib/supabase-route-client'
import { createPayfastCheckoutUrl } from '@/lib/payments/payfast'
import {
  SUBMISSION_ITEM_PRICING_COLUMNS,
  SUBMISSION_PRICING_COLUMNS,
  SubmissionPricingError,
  computeSubmissionPricing,
  pricingInputFromRows,
  toCents,
} from '@/lib/submission-pricing'
import type { SubmissionItemPricingRow, SubmissionPricingRow } from '@/lib/submission-pricing'

interface CheckoutBody {
  amountCents: number
  submissionId: string
}

/**
 * Creates the Payfast redirect for a grading submission's service fee.
 * Payfast is now the only processor this app talks to (see
 * lib/payments/payfast.ts) — the former Stripe/Payfast region split (SA ->
 * Payfast, UK/USA -> Stripe) is gone along with Stripe itself, since the
 * submit flow only ever offers South Africa now
 * (components/submit/step-grader-tier.tsx).
 *
 * The amount Payfast charges is recomputed here from the stored submission
 * and submission_items rows (lib/submission-pricing.ts), never taken from
 * the request. The client's amountCents is only used as a consistency
 * check: if it doesn't match, the customer was looking at a different
 * price than the one they'd be charged, so checkout is refused rather than
 * silently charging a different amount.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json()) as CheckoutBody

  if (!body.submissionId) {
    return NextResponse.json({ error: 'submissionId is required' }, { status: 400 })
  }

  const supabase = await getSupabaseRouteClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: submission } = await supabase
    .from('submissions')
    .select(`id, shipping_address_snapshot, payment_status, ${SUBMISSION_PRICING_COLUMNS}`)
    .eq('id', body.submissionId)
    .eq('user_id', user.id)
    .single()

  if (!submission) {
    return NextResponse.json({ error: 'Submission not found for this account' }, { status: 400 })
  }
  if (submission.payment_status !== 'pending') {
    return NextResponse.json({ error: 'This submission has already been paid or closed' }, { status: 400 })
  }

  const { data: items, error: itemsError } = await supabase
    .from('submission_items')
    .select(SUBMISSION_ITEM_PRICING_COLUMNS)
    .eq('submission_id', submission.id)
  if (itemsError || !items?.length) {
    return NextResponse.json({ error: 'Could not load the cards for this submission' }, { status: 400 })
  }

  let amount: number
  try {
    amount = computeSubmissionPricing(
      pricingInputFromRows(submission as unknown as SubmissionPricingRow, items as SubmissionItemPricingRow[]),
    ).total
  } catch (err) {
    if (err instanceof SubmissionPricingError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    throw err
  }
  if (toCents(amount) !== Math.round(Number(body.amountCents))) {
    return NextResponse.json(
      { error: 'The price for this submission has changed. Please refresh and review your order summary.' },
      { status: 409 },
    )
  }

  const addressName = (submission.shipping_address_snapshot as { name?: string } | null)?.name ?? ''
  const [nameFirst, ...rest] = addressName.split(' ')

  const origin = request.headers.get('origin') ?? new URL(request.url).origin
  const redirectUrl = createPayfastCheckoutUrl({
    mPaymentId: body.submissionId,
    amount,
    itemName: `CuppasCards grading submission #${body.submissionId.slice(0, 8).toUpperCase()}`,
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
