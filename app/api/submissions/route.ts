import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRouteClient } from '@/lib/supabase-route-client'
import { REGION_EXCHANGE_RATE_TO_ZAR, REGION_OPTIONS, REGION_TAX_RATE } from '@/lib/shop/product-type'
import type { CardType, GradingCompany, ProductRegion, Sport, SubmissionTier } from '@/lib/submission-types'

const VALID_REGIONS = new Set(REGION_OPTIONS.map((r) => r.value))

interface SubmissionItemInput {
  cardType: CardType
  sport: Sport | null
  cardName: string
  setName: string
  cardNumber: string
  year: string | null
  externalCardId: string | null
  externalSource: string | null
  declaredValue: number
  marketValueEstimate: number | null
  marketValueSource: string | null
  preCheckOptIn: boolean
}

const VALID_SPORTS: Sport[] = ['soccer', 'rugby', 'f1', 'nhl', 'nba', 'mlb', 'nfl']

// Postgres/PostgREST can never store a literal null byte (or other C0
// control characters) in a text column at all -- not a validation choice,
// a hard limit -- so an insert containing one always fails with a raw
// "unsupported Unicode escape sequence" error (MAJOR SYSTEMS TEST 2's
// injection-multi profile hits this directly). The browser's own card-entry
// UI can't produce one, but this route accepts arbitrary JSON from any API
// client, so a crafted request still could. Rejecting it here, before the
// submission row is even created, avoids ever reaching that DB error and
// avoids the orphaned-empty-submission scenario a mid-flight items-insert
// failure would otherwise leave behind (see the itemsError handling below).
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/
function hasControlCharacters(value: string): boolean {
  return CONTROL_CHARACTERS.test(value)
}

function isValidItem(item: SubmissionItemInput): boolean {
  if (item.cardType !== 'pokemon' && item.cardType !== 'sports_card') return false
  if (item.cardType === 'sports_card' && (!item.sport || !VALID_SPORTS.includes(item.sport))) return false
  if (item.cardType === 'pokemon' && item.sport !== null) return false
  if (!item.cardName?.trim() || !item.setName?.trim()) return false
  if (hasControlCharacters(item.cardName) || hasControlCharacters(item.setName)) return false
  if (item.cardNumber && hasControlCharacters(item.cardNumber)) return false
  return true
}

interface CreateSubmissionBody {
  gradingCompany: GradingCompany
  tier: SubmissionTier
  region: ProductRegion
  addressId: string
  courier: string
  serviceFee: number
  needsCleanAndPolish: boolean
  needsSemiRigids: boolean
  interestedInConsignment: boolean
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
  if (!body.region || !VALID_REGIONS.has(body.region)) {
    return NextResponse.json({ error: 'A valid country of origin is required' }, { status: 400 })
  }
  // Sport-vs-card_type consistency is also enforced by the database
  // (chk_submission_items_sport_matches_card_type, 0025_add_sports_card_fields.sql)
  // -- checked here too so a bad request fails with a clear message instead
  // of a raw constraint-violation error, and before a submission row is
  // created for items that are about to be rejected anyway.
  if (!body.items.every(isValidItem)) {
    return NextResponse.json({ error: 'One or more cards are missing required fields' }, { status: 400 })
  }
  if (body.courier && hasControlCharacters(body.courier)) {
    return NextResponse.json({ error: 'Invalid characters in courier' }, { status: 400 })
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

  // Bookkeeping only -- doesn't change body.serviceFee, what the customer
  // is actually charged (app/api/submissions/checkout/route.ts). Rates are
  // static placeholders (lib/shop/product-type.ts's REGION_TAX_RATE /
  // REGION_EXCHANGE_RATE_TO_ZAR), not real jurisdiction/FX figures yet.
  const taxRate = REGION_TAX_RATE[body.region]
  const exchangeRate = REGION_EXCHANGE_RATE_TO_ZAR[body.region]
  const taxCollected = Math.round(body.serviceFee * taxRate * 100) / 100

  // qr_code_token is generated server-side by Postgres (default gen_random_uuid())
  // and only ever read back here — the client never supplies or invents it.
  const { data: submission, error: submissionError } = await supabase
    .from('submissions')
    .insert({
      user_id: user.id,
      grading_company: body.gradingCompany,
      tier: body.tier,
      region: body.region,
      status: 'received',
      courier: body.courier,
      address_id: body.addressId,
      shipping_address_snapshot: address,
      total_declared_value: totalDeclaredValue,
      service_fee: body.serviceFee,
      payment_status: 'pending',
      tax_rate: taxRate,
      tax_collected: taxCollected,
      exchange_rate_to_zar: exchangeRate,
      needs_clean_and_polish: Boolean(body.needsCleanAndPolish),
      needs_semi_rigids: Boolean(body.needsSemiRigids),
      interested_in_consignment: Boolean(body.interestedInConsignment),
    })
    .select('id, qr_code_token, pool_id')
    .single()

  if (submissionError || !submission) {
    console.error('submissions insert failed:', submissionError?.message)
    return NextResponse.json({ error: 'Could not create submission' }, { status: 500 })
  }

  const { error: itemsError } = await supabase.from('submission_items').insert(
    body.items.map((item) => ({
      submission_id: submission.id,
      card_type: item.cardType,
      sport: item.sport,
      card_name: item.cardName,
      set_name: item.setName,
      card_number: item.cardNumber || null,
      year: item.year,
      external_card_id: item.externalCardId,
      external_source: item.externalSource,
      declared_value: item.declaredValue,
      market_value_estimate: item.marketValueEstimate,
      market_value_source: item.marketValueSource,
      pre_check_opt_in: item.preCheckOptIn,
    })),
  )

  if (itemsError) {
    // Items failed after the parent row was created — surface it rather than
    // silently leaving an empty submission; the caller can retry or the
    // submission can be cleaned up by an admin/cron sweep of empty orders.
    // The raw Postgres error is logged server-side only (MAJOR SYSTEMS TEST 2
    // finding: it previously leaked schema/constraint details, e.g. "unsupported
    // Unicode escape sequence", straight into the JSON response body).
    console.error('submission_items insert failed:', itemsError.message)
    return NextResponse.json({ error: 'Could not create submission items' }, { status: 500 })
  }

  // Revenue/liability/tax split (0034_accounting_foundations.sql's
  // post_submission_ledger_entries -- a security definer RPC, since this
  // customer's own session isn't an admin and ledger_entries' RLS is
  // admin-only for direct table access). The liability lookup (what we
  // actually pay this grading_company for this tier) happens inside that
  // function, against grading_tier_costs -- every row there is null until
  // a real wholesale cost is filled in, so liability posts as 0 today and
  // the whole post-tax fee is revenue, not a fabricated split. Best-effort:
  // a bookkeeping failure here shouldn't fail a real submission the
  // customer already paid to create, but it is logged so it doesn't
  // disappear silently.
  const feeZar = body.serviceFee * exchangeRate
  const taxZar = taxCollected * exchangeRate
  const { error: ledgerError } = await supabase.rpc('post_submission_ledger_entries', {
    p_submission_id: submission.id,
    p_grading_company: body.gradingCompany,
    p_tier: body.tier,
    p_fee_zar: feeZar,
    p_tax_collected_zar: taxZar,
  })
  if (ledgerError) {
    console.error('Could not post ledger entries for submission', submission.id, ledgerError.message)
  }

  return NextResponse.json({
    submissionId: submission.id,
    qrCodeToken: submission.qr_code_token,
    poolId: submission.pool_id,
  })
}
