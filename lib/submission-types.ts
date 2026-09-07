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
  | 'ace_value'
  | 'ace_basic'
  | 'ace_standard'

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
  { value: 'ACE', label: 'ACE Grading' },
]

export interface TierOption {
  value: SubmissionTier
  label: string
  turnaround?: string
  note?: string
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
  ACE: [
    { value: 'ace_value', label: 'Value', basePriceUSD: 20, basePriceGBP: 16, basePriceZAR: 370 },
    { value: 'ace_basic', label: 'Basic', basePriceUSD: 24, basePriceGBP: 19, basePriceZAR: 445 },
    { value: 'ace_standard', label: 'Standard', basePriceUSD: 34, basePriceGBP: 27, basePriceZAR: 630 },
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
  stripe_payment_intent_id: string | null
  qr_code_token: string
  notes: string | null
  region: ProductRegion
  created_at: string
  updated_at: string
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
  /** Present when selected with `select('*, profiles(full_name)')`, as the admin intake panel does. */
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
