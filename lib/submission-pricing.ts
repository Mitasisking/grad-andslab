import {
  ACE_LABEL_OPTIONS,
  SLAB_GUARD_FEE_ZAR,
  TIER_OPTIONS_BY_COMPANY,
  cleanAndPolishFeeForRegion,
  domesticCourierLegFeeForRegion,
  inspectionFeeForRegion,
  internationalCourierLegFeeForRegion,
  labelOptionFeeForRegion,
  secursusInsuranceLegFeeZAR,
  tierPriceForRegion,
} from '@/lib/submission-types'
import type {
  AceLabelOption,
  GradingCompany,
  IntakeChannel,
  ProductRegion,
  SubmissionTier,
  SubmissionType,
} from '@/lib/submission-types'

/**
 * Single source of truth for what a grading submission costs. Used by the
 * Review & Pay step (components/submit/step-review-pay.tsx) to render the
 * Order Summary, and by the server (app/api/submissions/route.ts,
 * app/api/submissions/checkout/route.ts, app/api/webhooks/payfast/route.ts)
 * to decide what is actually stored, charged, and accepted as paid -- so the
 * browser can never pick its own price. Every input is something the
 * submission and submission_items rows already store, which is what lets
 * the server recompute the total from the database alone
 * (pricingInputFromRows below).
 */
export interface SubmissionPricingInput {
  gradingCompany: GradingCompany
  tier: SubmissionTier
  region: ProductRegion
  submissionType: SubmissionType
  /** Only meaningful for ACE; ignored (priced as free) for every other company. */
  aceLabelOption: AceLabelOption | null
  intakeChannel: IntakeChannel
  needsCleanAndPolish: boolean
  /** Optional flat R95 Slab Guard add-on. */
  requiresSlabGuard: boolean
  cards: { declaredValue: number; preCheckOptIn: boolean }[]
}

export interface SubmissionPricing {
  perCardFee: number
  gradingSubtotal: number
  labelOptionSubtotal: number
  cardsWithPrepCount: number
  cuppasServicesSubtotal: number
  slabGuardSubtotal: number
  domesticLegFee: number
  localCourierTotal: number
  internationalLegFee: number
  internationalCourierTotal: number
  totalDeclaredValueZAR: number
  secursusInsuranceLegFee: number
  secursusInsuranceTotal: number
  /** Everything except the domestic courier legs -- stored as submissions.service_fee. */
  serviceFee: number
  /** What the customer pays: serviceFee + the domestic courier legs. */
  total: number
}

export class SubmissionPricingError extends Error {}

function roundCents(value: number): number {
  return Math.round(value * 100) / 100
}

export function computeSubmissionPricing(input: SubmissionPricingInput): SubmissionPricing {
  const tierMeta = TIER_OPTIONS_BY_COMPANY[input.gradingCompany]?.find((t) => t.value === input.tier)
  if (!tierMeta) {
    throw new SubmissionPricingError(`Unknown tier "${input.tier}" for ${input.gradingCompany}`)
  }
  if (input.cards.length === 0) {
    throw new SubmissionPricingError('At least one card is required')
  }
  if (!input.cards.every((c) => Number.isFinite(c.declaredValue) && c.declaredValue >= 0)) {
    throw new SubmissionPricingError('Every declared value must be a number of zero or more')
  }

  const cardCount = input.cards.length
  const perCardFee = tierPriceForRegion(tierMeta, input.region)
  const gradingSubtotal = perCardFee * cardCount

  // Label options only exist for ACE; any other company's submission is
  // always priced as the free Standard label.
  const labelOptionMeta =
    input.gradingCompany === 'ACE'
      ? (ACE_LABEL_OPTIONS.find((o) => o.value === input.aceLabelOption) ?? ACE_LABEL_OPTIONS[0])
      : ACE_LABEL_OPTIONS[0]
  const labelOptionSubtotal = labelOptionFeeForRegion(labelOptionMeta, input.region) * cardCount

  // Full Clean & Polish and per-card pre-grading prep are mutually
  // exclusive (components/submit/step-addons.tsx) -- Clean & Polish wins.
  const cardsWithPrepCount = input.cards.filter((c) => c.preCheckOptIn).length
  const cuppasServicesSubtotal = input.needsCleanAndPolish
    ? cleanAndPolishFeeForRegion(input.region)
    : cardsWithPrepCount * inspectionFeeForRegion(input.region)

  // Slab Guard: a flat fee per submission, always ZAR (no USD/GBP price exists).
  const slabGuardSubtotal = input.requiresSlabGuard ? SLAB_GUARD_FEE_ZAR : 0

  // Domestic leg (customer <-> HQ): two legs, waived for in-person drop-off.
  const domesticLegFee = domesticCourierLegFeeForRegion(input.region)
  const localCourierTotal = input.intakeChannel === 'in_person_event' ? 0 : domesticLegFee * 2

  // International leg (SA <-> the grader's UK facility): always two legs.
  const internationalLegFee = internationalCourierLegFeeForRegion(input.submissionType, input.region)
  const internationalCourierTotal = internationalLegFee * 2

  // Mandatory Secursus insurance: 15% of total declared value per leg, two
  // legs (30% in total). Always ZAR -- see secursusInsuranceLegFeeZAR.
  const totalDeclaredValueZAR = input.cards.reduce((sum, c) => sum + c.declaredValue, 0)
  const secursusInsuranceLegFee = secursusInsuranceLegFeeZAR(totalDeclaredValueZAR)
  const secursusInsuranceTotal = secursusInsuranceLegFee * 2

  const serviceFee = roundCents(
    gradingSubtotal +
      labelOptionSubtotal +
      cuppasServicesSubtotal +
      slabGuardSubtotal +
      internationalCourierTotal +
      secursusInsuranceTotal,
  )
  const total = roundCents(serviceFee + localCourierTotal)

  return {
    perCardFee,
    gradingSubtotal,
    labelOptionSubtotal,
    cardsWithPrepCount,
    cuppasServicesSubtotal,
    slabGuardSubtotal,
    domesticLegFee,
    localCourierTotal,
    internationalLegFee,
    internationalCourierTotal,
    totalDeclaredValueZAR,
    secursusInsuranceLegFee,
    secursusInsuranceTotal,
    serviceFee,
    total,
  }
}

/** Column subset of public.submissions that pricing depends on. */
export const SUBMISSION_PRICING_COLUMNS =
  'grading_company, tier, region, submission_type, ace_label_option, intake_channel, needs_clean_and_polish, requires_slab_guard'

/** Column subset of public.submission_items that pricing depends on. */
export const SUBMISSION_ITEM_PRICING_COLUMNS = 'declared_value, pre_check_opt_in'

export interface SubmissionPricingRow {
  grading_company: GradingCompany
  tier: SubmissionTier
  region: ProductRegion
  submission_type: SubmissionType | null
  ace_label_option: AceLabelOption | null
  intake_channel: IntakeChannel | null
  needs_clean_and_polish: boolean | null
  requires_slab_guard: boolean | null
}

export interface SubmissionItemPricingRow {
  declared_value: number | string
  pre_check_opt_in: boolean | null
}

/** Rebuilds the pricing input from stored rows, so the server can recompute a submission's total from the database alone. */
export function pricingInputFromRows(
  submission: SubmissionPricingRow,
  items: SubmissionItemPricingRow[],
): SubmissionPricingInput {
  return {
    gradingCompany: submission.grading_company,
    tier: submission.tier,
    region: submission.region,
    submissionType: submission.submission_type ?? 'batch',
    aceLabelOption: submission.ace_label_option,
    intakeChannel: submission.intake_channel ?? 'online_shipment',
    needsCleanAndPolish: Boolean(submission.needs_clean_and_polish),
    requiresSlabGuard: Boolean(submission.requires_slab_guard),
    // numeric columns come back from PostgREST as strings.
    cards: items.map((item) => ({ declaredValue: Number(item.declared_value), preCheckOptIn: Boolean(item.pre_check_opt_in) })),
  }
}

/** Integer cents, for comparing a charged amount to a computed total without floating-point drift. */
export function toCents(amount: number): number {
  return Math.round(amount * 100)
}
