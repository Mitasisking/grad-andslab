/** We exclusively grade through Premier Card Grading (PCG) -- see supabase/migrations/0016 and 0017. */
export type GradingCompany = 'PCG'
export type SubmissionTier = 'authentication' | 'bulk' | 'standard' | 'express'
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

export const GRADING_COMPANY: GradingCompany = 'PCG'

/**
 * PCG's four real service tiers (replacing the old economy/regular/express/
 * super_express/walk_through placeholders). basePriceZAR is the per-card fee
 * charged to the customer -- these are the only numbers that need to change
 * to adjust your margin, so edit them directly here.
 */
export const TIER_OPTIONS: {
  value: SubmissionTier
  label: string
  turnaround: string
  note?: string
  basePriceZAR: number
}[] = [
  { value: 'authentication', label: 'Authentication', turnaround: '2–4 weeks', basePriceZAR: 250 },
  { value: 'bulk', label: 'Bulk', turnaround: '8–10 weeks', note: 'Minimum 50+ cards', basePriceZAR: 180 },
  {
    value: 'standard',
    label: 'Standard',
    turnaround: '4–6 weeks',
    note: 'Includes sub-grades & metal labels',
    basePriceZAR: 320,
  },
  { value: 'express', label: 'Express', turnaround: '5–7 days', basePriceZAR: 650 },
]

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
