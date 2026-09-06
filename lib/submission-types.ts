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
export type PrecheckAction = 'proceed_regardless' | 'return_if_under_target'

export interface CardEntry {
  id: string
  cardName: string
  setName: string
  cardNumber: string
  declaredValue: number
  marketValueEstimate: number | null
  marketValueSource: string | null
  isFetchingValue: boolean
  preCheckOptIn: boolean
  precheckAction: PrecheckAction
  targetGrade: number | null
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
}

/**
 * Per-card grading fee by company and tier, all in USD -- the grading
 * submission flow charges and displays exclusively in dollars (see
 * lib/currency.ts's formatUSD and app/api/submissions/checkout/route.ts),
 * independent of the ZAR the rest of the marketplace uses.
 *
 * PCG's four tiers were originally configured in ZAR (R250/R180/R320/R650);
 * the basePriceUSD values below are those converted at ~18.5 ZAR/USD and
 * rounded to a clean price point, not the raw digits relabeled -- re-derive
 * them from that rate (or your own real invoiced cost) if it drifts.
 * PSA and ACE are flat USD tiers as given by the business, no conversion.
 */
export const TIER_OPTIONS_BY_COMPANY: Record<GradingCompany, TierOption[]> = {
  PCG: [
    { value: 'authentication', label: 'Authentication', turnaround: '2–4 weeks', basePriceUSD: 14 },
    { value: 'bulk', label: 'Bulk', turnaround: '8–10 weeks', note: 'Minimum 50+ cards', basePriceUSD: 10 },
    {
      value: 'standard',
      label: 'Standard',
      turnaround: '4–6 weeks',
      note: 'Includes sub-grades & metal labels',
      basePriceUSD: 17,
    },
    { value: 'express', label: 'Express', turnaround: '5–7 days', basePriceUSD: 35 },
  ],
  PSA: [
    { value: 'psa_value_bulk', label: 'Value Bulk', note: 'Minimum 50+ cards', basePriceUSD: 25 },
    { value: 'psa_regular', label: 'Regular', basePriceUSD: 80 },
    { value: 'psa_express', label: 'Express', basePriceUSD: 149 },
  ],
  ACE: [
    { value: 'ace_value', label: 'Value', basePriceUSD: 20 },
    { value: 'ace_basic', label: 'Basic', basePriceUSD: 24 },
    { value: 'ace_standard', label: 'Standard', basePriceUSD: 34 },
  ],
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
  created_at: string
  updated_at: string
}

export interface SubmissionItemRow {
  id: string
  submission_id: string
  card_name: string
  set_name: string
  card_number: string | null
  declared_value: number
  market_value_estimate: number | null
  market_value_source: string | null
  pre_check_opt_in: boolean
  precheck_action: PrecheckAction | null
  target_grade: number | null
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
