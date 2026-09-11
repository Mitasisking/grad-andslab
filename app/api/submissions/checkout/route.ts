import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRouteClient } from '@/lib/supabase-route-client'
import { createPayfastCheckoutUrl } from '@/lib/payments/payfast'

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
 */
export async function POST(request: NextRequest) {
  const body = (await request.json()) as CheckoutBody

  if (!Number.isFinite(body.amountCents) || body.amountCents < 100) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
  }
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
