import {
  ACE_LABEL_OPTIONS,
  LEGACY_SLAB_GUARD_FEE_ZAR,
  SLAB_GUARD_FEE_ZAR,
  TIER_OPTIONS_BY_COMPANY,
  cleaningTierFeeZAR,
  domesticCourierLegFeeForRegion,
  internationalCourierLegFeeForRegion,
  isCleaningTier,
  legacyCleanAndPolishFeeForRegion,
  labelOptionFeeForRegion,
  secursusInsuranceLegFeeZAR,
  tierPriceForRegion,
} from '@/lib/submission-types'
import type {
  AceLabelOption,
  CleaningTier,
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
export interface SubmissionPricingCard {
  declaredValue: number
  cleaningTier: CleaningTier
  requiresSlabGuard: boolean
}

export interface SubmissionPricingInput {
  gradingCompany: GradingCompany
  tier: SubmissionTier
  region: ProductRegion
  submissionType: SubmissionType
  /** Only meaningful for ACE; ignored (priced as free) for every other company. */
  aceLabelOption: AceLabelOption | null
  intakeChannel: IntakeChannel
  /**
   * Retired submission-level add-ons (submissions.needs_clean_and_polish /
   * requires_slab_guard). Only ever true for a submission placed before the
   * per-card rework, so its stored rows still re-price to what was charged;
   * new submissions always pass false.
   */
  legacyCleanAndPolish: boolean
  legacySlabGuard: boolean
  cards: SubmissionPricingCard[]
}

export interface SubmissionPricing {
  perCardFee: number
  gradingSubtotal: number
  labelOptionSubtotal: number
  halfCleanCount: number
  fullCleanCount: number
  /** Sum of every card's own cleaning choice. */
  cleaningSubtotal: number
  slabGuardCount: number
  /** SLAB_GUARD_FEE_ZAR per card that opted in. */
  slabGuardSubtotal: number
  /** Retired flat add-ons -- see SubmissionPricingInput.legacyCleanAndPolish. Zero for every new submission. */
  legacyCleanAndPolishSubtotal: number
  legacySlabGuardSubtotal: number
  domesticLegFee: number
  localCourierTotal: number
  internationalLegFee: number
  internationalCourierTotal: number
  totalDeclaredValueZAR: number
  secursusInsuranceLegFee: number
  secursusInsuranceTotal: number
  /** Everything except the domestic return courier leg -- stored as submissions.service_fee. */
  serviceFee: number
  /** What the customer pays: serviceFee + the domestic return courier leg. */
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
  if (!input.cards.every((c) => isCleaningTier(c.cleaningTier) && typeof c.requiresSlabGuard === 'boolean')) {
    throw new SubmissionPricingError('Every card needs a valid cleaning option and Slab Guard choice')
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

  // Per-card add-ons (components/submit/step-addons.tsx): each card's own
  // cleaning choice and Slab Guard, summed across the submission. Always
  // ZAR -- neither has a USD/GBP price.
  const halfCleanCount = input.cards.filter((c) => c.cleaningTier === 'half').length
  const fullCleanCount = input.cards.filter((c) => c.cleaningTier === 'full').length
  const cleaningSubtotal = input.cards.reduce((sum, c) => sum + cleaningTierFeeZAR(c.cleaningTier), 0)
  const slabGuardCount = input.cards.filter((c) => c.requiresSlabGuard).length
  const slabGuardSubtotal = slabGuardCount * SLAB_GUARD_FEE_ZAR

  const legacyCleanAndPolishSubtotal = input.legacyCleanAndPolish ? legacyCleanAndPolishFeeForRegion(input.region) : 0
  const legacySlabGuardSubtotal = input.legacySlabGuard ? LEGACY_SLAB_GUARD_FEE_ZAR : 0

  // Domestic courier: customers arrange and pay for their own shipping to
  // HQ, so only the single return leg (HQ -> customer) is charged. Waived
  // for in-person drop-off, where the cards are collected in person too.
  const domesticLegFee = domesticCourierLegFeeForRegion(input.region)
  const localCourierTotal = input.intakeChannel === 'in_person_event' ? 0 : domesticLegFee

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
      cleaningSubtotal +
      slabGuardSubtotal +
      legacyCleanAndPolishSubtotal +
      legacySlabGuardSubtotal +
      internationalCourierTotal +
      secursusInsuranceTotal,
  )
  const total = roundCents(serviceFee + localCourierTotal)

  return {
    perCardFee,
    gradingSubtotal,
    labelOptionSubtotal,
    halfCleanCount,
    fullCleanCount,
    cleaningSubtotal,
    slabGuardCount,
    slabGuardSubtotal,
    legacyCleanAndPolishSubtotal,
    legacySlabGuardSubtotal,
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
export const SUBMISSION_ITEM_PRICING_COLUMNS = 'declared_value, cleaning_tier, requires_slab_guard'

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
  cleaning_tier: CleaningTier | null
  requires_slab_guard: boolean | null
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
    legacyCleanAndPolish: Boolean(submission.needs_clean_and_polish),
    legacySlabGuard: Boolean(submission.requires_slab_guard),
    cards: items.map((item) => ({
      // numeric columns come back from PostgREST as strings.
      declaredValue: Number(item.declared_value),
      cleaningTier: item.cleaning_tier ?? 'none',
      requiresSlabGuard: Boolean(item.requires_slab_guard),
    })),
  }
}

/** Integer cents, for comparing a charged amount to a computed total without floating-point drift. */
export function toCents(amount: number): number {
  return Math.round(amount * 100)
}
