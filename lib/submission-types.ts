export type GradingCompany = 'PSA' | 'CGC' | 'BGS'
export type SubmissionTier = 'economy' | 'regular' | 'express' | 'super_express' | 'walk_through'
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

/** Base per-card grading fee in USD before the tier multiplier is applied. */
export const BASE_FEE_USD = 18

export const GRADER_OPTIONS: { value: GradingCompany; description: string }[] = [
  { value: 'PSA', description: 'Widest market recognition, longest queue' },
  { value: 'CGC', description: 'Fast turnaround, strong for modern sealed' },
  { value: 'BGS', description: 'Subgrades on every card, black label at 10' },
]

export const TIER_OPTIONS: {
  value: SubmissionTier
  label: string
  turnaround: string
  feeMultiplier: number
}[] = [
  { value: 'economy', label: 'Economy', turnaround: '45–65 business days', feeMultiplier: 1 },
  { value: 'regular', label: 'Regular', turnaround: '20–30 business days', feeMultiplier: 1.6 },
  { value: 'express', label: 'Express', turnaround: '10–15 business days', feeMultiplier: 2.4 },
  { value: 'super_express', label: 'Super express', turnaround: '3–5 business days', feeMultiplier: 4 },
  { value: 'walk_through', label: 'Walk-through', turnaround: '24–48 hours', feeMultiplier: 8 },
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
