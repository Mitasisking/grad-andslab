import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRouteClient } from '@/lib/supabase-route-client'
import type { GradingCompany, PrecheckAction, SubmissionTier } from '@/lib/submission-types'

interface SubmissionItemInput {
  cardName: string
  setName: string
  cardNumber: string
  declaredValue: number
  marketValueEstimate: number | null
  marketValueSource: string | null
  preCheckOptIn: boolean
  precheckAction: PrecheckAction
  targetGrade: number | null
}

interface CreateSubmissionBody {
  gradingCompany: GradingCompany
  tier: SubmissionTier
  addressId: string
  courier: string
  serviceFee: number
  items: SubmissionItemInput[]
}

export async function POST(request: NextRequest) {
  const supabase = await getSupabaseRouteClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = (await request.json()) as CreateSubmissionBody

  if (!body.items?.length) {
    return NextResponse.json({ error: 'At least one card is required' }, { status: 400 })
  }
  if (!body.addressId) {
    return NextResponse.json({ error: 'A shipping address is required' }, { status: 400 })
  }

  const { data: address, error: addressError } = await supabase
    .from('addresses')
    .select('*')
    .eq('id', body.addressId)
    .eq('user_id', user.id)
    .single()

  if (addressError || !address) {
    return NextResponse.json({ error: 'Address not found for this account' }, { status: 400 })
  }

  const totalDeclaredValue = body.items.reduce((sum, item) => sum + item.declaredValue, 0)

  // qr_code_token is generated server-side by Postgres (default gen_random_uuid())
  // and only ever read back here — the client never supplies or invents it.
  const { data: submission, error: submissionError } = await supabase
    .from('submissions')
    .insert({
      user_id: user.id,
      grading_company: body.gradingCompany,
      tier: body.tier,
      status: 'received',
      courier: body.courier,
      address_id: body.addressId,
      shipping_address_snapshot: address,
      total_declared_value: totalDeclaredValue,
      service_fee: body.serviceFee,
      payment_status: 'pending',
    })
    .select('id, qr_code_token')
    .single()

  if (submissionError || !submission) {
    return NextResponse.json(
      { error: submissionError?.message ?? 'Could not create submission' },
      { status: 500 },
    )
  }

  const { error: itemsError } = await supabase.from('submission_items').insert(
    body.items.map((item) => ({
      submission_id: submission.id,
      card_name: item.cardName,
      set_name: item.setName,
      card_number: item.cardNumber || null,
      declared_value: item.declaredValue,
      market_value_estimate: item.marketValueEstimate,
      market_value_source: item.marketValueSource,
      pre_check_opt_in: item.preCheckOptIn,
      precheck_action: item.precheckAction,
      target_grade: item.targetGrade,
    })),
  )

  if (itemsError) {
    // Items failed after the parent row was created — surface it rather than
    // silently leaving an empty submission; the caller can retry or the
    // submission can be cleaned up by an admin/cron sweep of empty orders.
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  return NextResponse.json({
    submissionId: submission.id,
    qrCodeToken: submission.qr_code_token,
  })
}
