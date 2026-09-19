import type { ProductRegion } from '@/lib/shop/product-type'

export type { ProductRegion }

/**
 * We grade through three partners -- see supabase/migrations/0016-0017 (PCG)
 * and 0021-0023 (PSA, ACE). Each company's tiers are their own real service
 * names/prices, so SubmissionTier below is a union of all three, prefixed by
 * company except for PCG's (added first, before there was anything to
 * disambiguate from).
 */
export type GradingCompany = 'PCG' | 'PSA' | 'ACE'
export type SubmissionTier =
  | 'authentication'
  | 'bulk'
  | 'standard'
  | 'express'
  | 'psa_value_bulk'
  | 'psa_regular'
  | 'psa_express'
  /**
   * Deprecated as of the 2026-09 ACE tier overhaul -- no longer offered in
   * TIER_OPTIONS_BY_COMPANY.ACE or selectable in the submission wizard.
   * Kept in this union (and in the DB enum/CHECK constraint, see
   * supabase/migrations/0060) purely so historical submissions placed under
   * the old tier still type- and query-check correctly. Do not re-offer it.
   */
  | 'ace_value'
  | 'ace_basic'
  | 'ace_standard'
  | 'ace_premier'
  | 'ace_ultra'
  | 'ace_luxury'

/** Which search flow a card entry uses -- see components/submit/card-shipment-row.tsx. */
export type CardType = 'pokemon' | 'sports_card'
export type Sport = 'soccer' | 'rugby' | 'f1' | 'nhl' | 'nba' | 'mlb' | 'nfl'

export const SPORT_OPTIONS: { value: Sport; label: string }[] = [
  { value: 'soccer', label: 'Soccer' },
  { value: 'rugby', label: 'Rugby' },
  { value: 'f1', label: 'F1' },
  { value: 'nhl', label: 'NHL' },
  { value: 'nba', label: 'NBA' },
  { value: 'mlb', label: 'Baseball' },
  { value: 'nfl', label: 'American Football' },
]

export interface CardEntry {
  id: string
  cardType: CardType
  /** Only set (and only meaningful) when cardType is 'sports_card'. */
  sport: Sport | null
  cardName: string
  setName: string
  cardNumber: string
  /** Sports cards are commonly cataloged by year; Pokemon cards use setName instead. */
  year: string | null
  /** The catalog API's product id + which provider it came from, once a search result is picked. */
  externalCardId: string | null
  externalSource: string | null
  declaredValue: number
  marketValueEstimate: number | null
  marketValueSource: string | null
  isFetchingValue: boolean
  preCheckOptIn: boolean
}

export interface ShippingAddress {
  id: string
  label: string
  name: string
  line1: string
  line2?: string
  city: string
  state: string
  postal: string
  country: string
}

/** Shown in the grading-company picker (components/submit/step-grader-tier.tsx). */
export const GRADING_COMPANY_OPTIONS: { value: GradingCompany; label: string; url?: string }[] = [
  { value: 'PCG', label: 'Premier Card Grading (PCG)', url: 'https://premiercardgrading.co.uk/' },
  { value: 'PSA', label: 'PSA' },
  { value: 'ACE', label: 'ACE Grading', url: 'https://acegrading.com' },
]

export interface TierOption {
  value: SubmissionTier
  label: string
  turnaround?: string
  note?: string
  /** Short marketing blurb shown under the label (e.g. ACE's Flagship/Premium tiers). */
  description?: string
  /** Groups tiers under a subheading in the tier selector (e.g. ACE's "Flagship"/"Premium"). Tiers without a group render as a flat list, same as before. */
  group?: string
  basePriceUSD: number
  basePriceGBP: number
  basePriceZAR: number
}

/**
 * Per-card grading fee by company and tier. basePriceUSD is the real,
 * business-set cost (PSA/ACE as given; PCG converted from its original ZAR
 * pricing -- see the note below). basePriceGBP/basePriceZAR are NOT
 * separately invoiced costs -- nobody has set those yet -- they're USD
 * converted at approximate flat rates (0.79 USD/GBP, 18.5 USD/ZAR, the same
 * ZAR rate already used for PCG below) and rounded to a clean price point,
 * matching how PCG's own USD figures were derived from ZAR. Replace with
 * real invoiced GBP/ZAR costs the moment the business has them -- these
 * are a stand-in, not a quoted price, exactly like PCG's basePriceUSD note
 * already warned about its own conversion drifting.
 *
 * PCG's four tiers were originally configured in ZAR (R250/R180/R320/R650);
 * the basePriceUSD values below are those converted at ~18.5 ZAR/USD and
 * rounded to a clean price point, not the raw digits relabeled -- re-derive
 * them from that rate (or your own real invoiced cost) if it drifts.
 * PSA and ACE are flat USD tiers as given by the business, no conversion.
 */
export const TIER_OPTIONS_BY_COMPANY: Record<GradingCompany, TierOption[]> = {
  PCG: [
    {
      value: 'authentication',
      label: 'Authentication',
      turnaround: '2–4 weeks',
      basePriceUSD: 14,
      basePriceGBP: 11,
      basePriceZAR: 260,
    },
    {
      value: 'bulk',
      label: 'Bulk',
      turnaround: '8–10 weeks',
      note: 'Minimum 50+ cards',
      basePriceUSD: 10,
      basePriceGBP: 8,
      basePriceZAR: 185,
    },
    {
      value: 'standard',
      label: 'Standard',
      turnaround: '4–6 weeks',
      note: 'Includes sub-grades & metal labels',
      basePriceUSD: 17,
      basePriceGBP: 13,
      basePriceZAR: 315,
    },
    {
      value: 'express',
      label: 'Express',
      turnaround: '5–7 days',
      basePriceUSD: 35,
      basePriceGBP: 28,
      basePriceZAR: 650,
    },
  ],
  PSA: [
    {
      value: 'psa_value_bulk',
      label: 'Value Bulk',
      note: 'Minimum 50+ cards',
      basePriceUSD: 25,
      basePriceGBP: 20,
      basePriceZAR: 465,
    },
    { value: 'psa_regular', label: 'Regular', basePriceUSD: 80, basePriceGBP: 63, basePriceZAR: 1480 },
    { value: 'psa_express', label: 'Express', basePriceUSD: 149, basePriceGBP: 118, basePriceZAR: 2755 },
  ],
  /**
   * ACE Grading's official tier structure (2026-09 overhaul), split into
   * "Flagship" and "Premium" service levels. GBP is the business-set,
   * official per-tier price for this update; basePriceUSD/basePriceZAR are
   * derived stand-in conversions at the same flat rates used everywhere
   * else in this file (USD = GBP / 0.79, ZAR = USD * 18.5, each rounded to
   * a clean price point) -- not separately invoiced costs. Replace with
   * real invoiced USD/ZAR figures the moment the business sets them, same
   * caveat as PCG's and the older ACE tiers' conversions above. The old
   * 'Value' tier (£16) is retired -- see the SubmissionTier union above for
   * why its value isn't deleted outright.
   */
  ACE: [
    {
      value: 'ace_basic',
      label: 'Basic',
      group: 'Flagship',
      turnaround: '30 days',
      description: 'Grading for everyday submissions',
      basePriceUSD: 23,
      basePriceGBP: 18,
      basePriceZAR: 425,
    },
    {
      value: 'ace_standard',
      label: 'Standard',
      group: 'Flagship',
      turnaround: '15 days',
      description: 'A balanced service combining speed & value',
      basePriceUSD: 32,
      basePriceGBP: 25,
      basePriceZAR: 590,
    },
    {
      value: 'ace_premier',
      label: 'Premier',
      group: 'Flagship',
      turnaround: '10 days',
      description: 'Faster grading for higher priority submissions',
      basePriceUSD: 41,
      basePriceGBP: 32,
      basePriceZAR: 760,
    },
    {
      value: 'ace_ultra',
      label: 'Ultra',
      group: 'Premium',
      turnaround: '5 days',
      description: 'Priority handling for high-value submissions',
      basePriceUSD: 76,
      basePriceGBP: 60,
      basePriceZAR: 1405,
    },
    {
      value: 'ace_luxury',
      label: 'Luxury',
      group: 'Premium',
      turnaround: '2 days',
      description: 'Our fastest, most premium grading service',
      basePriceUSD: 152,
      basePriceGBP: 120,
      basePriceZAR: 2810,
    },
  ],
}

/** Picks the right one of a TierOption's three currency fields for a region. */
export function tierPriceForRegion(tier: TierOption, region: ProductRegion): number {
  if (region === 'usa') return tier.basePriceUSD
  if (region === 'uk') return tier.basePriceGBP
  return tier.basePriceZAR
}

// ----------------------------------------------------------------------------
// Phase 3 — tracking dashboard & admin intake/grading
// Row shapes below mirror `select('*')` against supabase/migrations/0001_init_schema.sql
// (submissions, submission_items) and 0004_status_history.sql (submission_status_log).
// ----------------------------------------------------------------------------

export type SubmissionStatus = 'received' | 'inspected' | 'shipped' | 'graded' | 'returned'

export type PaymentStatus = 'pending' | 'authorized' | 'captured' | 'failed' | 'refunded'

/**
 * Lifecycle of the BATCH a submission ships in, distinct from the
 * submission's own SubmissionStatus above -- a submission can be 'received'
 * while its pool is still 'open'. See supabase/migrations/0035_submission_pools.sql.
 */
export type PoolStatus = 'open' | 'closed' | 'shipped' | 'completed'

export interface SubmissionRow {
  id: string
  user_id: string
  grading_company: GradingCompany
  tier: SubmissionTier
  status: SubmissionStatus
  tracking_number_in: string | null
  tracking_number_out: string | null
  courier: string | null
  shipping_address_snapshot: Record<string, unknown> | null
  total_declared_value: number
  service_fee: number
  payment_status: PaymentStatus
  qr_code_token: string
  notes: string | null
  region: ProductRegion
  needs_clean_and_polish: boolean
  needs_semi_rigids: boolean
  interested_in_consignment: boolean
  /** Only ever set for grading_company = 'ACE' (supabase/migrations/0061_add_ace_label_option.sql's CHECK constraint enforces this); null for every other submission. */
  ace_label_option: AceLabelOption | null
  pool_id: string | null
  pool_status: PoolStatus | null
  created_at: string
  updated_at: string
}

/** Mirrors supabase/migrations/0035_submission_pools.sql's public.pools table. */
export interface PoolRow {
  id: string
  grading_company: GradingCompany
  tier: SubmissionTier
  label: string
  capacity: number
  current_count: number
  status: PoolStatus
  opened_at: string
  closed_at: string | null
  shipped_at: string | null
  created_at: string
  updated_at: string
}

/**
 * Flat "Clean and Polish" pre-grading add-on (components/submit/step-addons.tsx)
 * -- R500 as set by the business; USD/GBP are the same approximate-conversion
 * stand-in as every other cross-currency figure in this file (~18.5 USD/ZAR,
 * ~0.79 USD/GBP). Edit directly if the business sets a real invoiced rate.
 */
export const CLEAN_AND_POLISH_FEE_USD = 27
export const CLEAN_AND_POLISH_FEE_GBP = 21
export const CLEAN_AND_POLISH_FEE_ZAR = 500

export function cleanAndPolishFeeForRegion(region: ProductRegion): number {
  if (region === 'usa') return CLEAN_AND_POLISH_FEE_USD
  if (region === 'uk') return CLEAN_AND_POLISH_FEE_GBP
  return CLEAN_AND_POLISH_FEE_ZAR
}

/**
 * Flat per-card fee for the optional pre-grading inspection add-on
 * (components/submit/step-addons.tsx's `preCheckOptIn`) -- R200 as set by
 * the business; USD/GBP are the same approximate-conversion stand-in as
 * every other cross-currency figure here (~18.5 USD/ZAR, ~0.79 USD/GBP).
 * Moved here (rather than staying local to step-review-pay.tsx) so
 * lib/email's order-confirmation template can price the same line item
 * server-side without duplicating the numbers.
 */
export const INSPECTION_FEE_USD = 11
export const INSPECTION_FEE_GBP = 8
export const INSPECTION_FEE_ZAR = 200

export function inspectionFeeForRegion(region: ProductRegion): number {
  if (region === 'usa') return INSPECTION_FEE_USD
  if (region === 'uk') return INSPECTION_FEE_GBP
  return INSPECTION_FEE_ZAR
}

/**
 * ACE Grading's label options -- a per-submission choice (applies to every
 * card in the batch, same as needs_clean_and_polish/needs_semi_rigids
 * above, not per-card) offered only when GradingCompany is 'ACE'. GBP is
 * the business-set official price; ZAR is ACE's own designated retail
 * price (R25/R75), NOT the ~18.5 USD/ZAR stand-in conversion used
 * elsewhere in this file -- ACE set these ZAR figures directly. USD is
 * still the usual derived stand-in (USD = GBP / 0.79) since no real
 * invoiced USD price has been set for this option yet.
 */
export type AceLabelOption = 'standard' | 'colour_match' | 'ace_label'

export interface LabelOptionMeta {
  value: AceLabelOption
  label: string
  feeUSD: number
  feeGBP: number
  feeZAR: number
}

export const ACE_LABEL_OPTIONS: LabelOptionMeta[] = [
  { value: 'standard', label: 'Standard', feeUSD: 0, feeGBP: 0, feeZAR: 0 },
  { value: 'colour_match', label: 'Colour Match', feeUSD: 1, feeGBP: 1, feeZAR: 25 },
  { value: 'ace_label', label: 'Ace Label', feeUSD: 4, feeGBP: 3, feeZAR: 75 },
]

export function labelOptionFeeForRegion(option: LabelOptionMeta, region: ProductRegion): number {
  if (region === 'usa') return option.feeUSD
  if (region === 'uk') return option.feeGBP
  return option.feeZAR
}

export interface SubmissionItemRow {
  id: string
  submission_id: string
  card_type: CardType
  sport: Sport | null
  card_name: string
  set_name: string
  card_number: string | null
  year: string | null
  external_card_id: string | null
  external_source: string | null
  declared_value: number
  market_value_estimate: number | null
  market_value_source: string | null
  pre_check_opt_in: boolean
  grade_result: number | null
  grade_cert_number: string | null
  hi_res_photo_url: string | null
  intake_photo_url: string | null
  created_at: string
  updated_at: string
}

export interface SubmissionStatusLogRow {
  id: string
  submission_id: string
  from_status: SubmissionStatus | null
  to_status: SubmissionStatus
  changed_by: string
  reason: string | null
  created_at: string
  /** Merged in by app/api/admin/intake/lookup/route.ts via a separate batched profiles lookup (public.profiles has no FK anywhere in production, so PostgREST's embed syntax can't be used here). */
  profiles?: { full_name: string | null } | null
}

/** The 5-stage pipeline in order, for progress bars and the admin "advance to next stage" action. */
export const STATUS_STAGES: { value: SubmissionStatus; label: string }[] = [
  { value: 'received', label: 'Received' },
  { value: 'inspected', label: 'Inspected' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'graded', label: 'Graded' },
  { value: 'returned', label: 'Vault / Return' },
]
