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
  /** Per-card pre-grading clean (components/submit/step-addons.tsx) -- see CLEANING_TIER_OPTIONS. */
  cleaningTier: CleaningTier
  /** Per-card Slab Guard bumper (components/submit/step-addons.tsx) -- see SLAB_GUARD_FEE_ZAR. */
  requiresSlabGuard: boolean
  /** Per-card ACE label (components/submit/step-addons.tsx) -- see ACE_LABEL_OPTIONS. */
  labelOption: AceLabelOption
}

/**
 * A change to one CardEntry: either fields to merge, or a function of the
 * card's *current* state for updates that land after an await (e.g. a
 * market-value lookup) and must not overwrite what the customer typed in
 * the meantime -- see components/submit/card-shipment-row.tsx.
 */
export type CardPatch = Partial<CardEntry> | ((current: CardEntry) => Partial<CardEntry>)

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

/**
 * Customer's choice of how their submission is dispatched internationally
 * to ACE Grading's UK facility -- see supabase/migrations/0065_add_submission_type.sql.
 * Deliberately NOT the same concept as pool_id/pool_status below: those
 * track membership in a specific, real public.pools row (opened via the
 * currently-hidden LiveBatchTracker UI); submission_type is a standing
 * customer preference that exists independently of whether a real pool is
 * open to join right now.
 */
export type SubmissionType = 'batch' | 'individual'

export interface SubmissionTypeOption {
  value: SubmissionType
  label: string
  badge: string
  summary: string
  detail: string
}

/** Shown in Step 1's "Submission Method" section (components/submit/step-grader-tier.tsx). */
export const SUBMISSION_TYPE_OPTIONS: SubmissionTypeOption[] = [
  {
    value: 'batch',
    label: 'Pooled Batch',
    badge: 'Most Economical',
    summary: 'Consolidated with our upcoming scheduled international shipment.',
    detail: 'Shared international freight and customs handling fees.',
  },
  {
    value: 'individual',
    label: 'Individual Direct Dispatch',
    badge: 'Fastest Turnaround',
    summary:
      'Dispatched directly to ACE Grading as a standalone shipment as soon as your cards arrive at HQ.',
    detail: 'Customer covers dedicated direct international courier & customs clearance fees.',
  },
]

/**
 * International freight contribution to ACE Grading's UK facility, billed
 * per submission (not per card) as two separate legs -- outbound (SA to UK)
 * and return (UK to SA) -- each at this same per-leg rate. 'batch' is a
 * shared contribution toward one consolidated shipment; 'individual' is a
 * full dedicated door-to-door courier quote, hence the large gap. Ballpark
 * stand-in figures, not yet a real invoiced business cost -- same "replace
 * once known" caveat as every other approximate-conversion figure in this
 * file. Superseded the old single lump-sum INTERNATIONAL_SHIPPING_FEE_*
 * constants (removed) when step-review-pay.tsx's Order Summary was split
 * into separate outbound/return line items.
 */
export const INTERNATIONAL_COURIER_LEG_FEE_USD: Record<SubmissionType, number> = {
  batch: 6,
  individual: 76,
}
export const INTERNATIONAL_COURIER_LEG_FEE_GBP: Record<SubmissionType, number> = {
  batch: 5,
  individual: 60,
}
export const INTERNATIONAL_COURIER_LEG_FEE_ZAR: Record<SubmissionType, number> = {
  batch: 110,
  individual: 1400,
}

export function internationalCourierLegFeeForRegion(submissionType: SubmissionType, region: ProductRegion): number {
  if (region === 'usa') return INTERNATIONAL_COURIER_LEG_FEE_USD[submissionType]
  if (region === 'uk') return INTERNATIONAL_COURIER_LEG_FEE_GBP[submissionType]
  return INTERNATIONAL_COURIER_LEG_FEE_ZAR[submissionType]
}

/** Order Summary line-item labels for the two international courier legs (components/submit/step-review-pay.tsx), distinguishing the two dispatch methods. */
export const INTERNATIONAL_COURIER_LEG_LABELS: Record<SubmissionType, { outbound: string; returnLeg: string }> = {
  batch: {
    outbound: 'International Courier: Outbound to ACE UK (Pooled)',
    returnLeg: 'International Courier: Return to SA (Pooled)',
  },
  individual: {
    outbound: 'International Courier: Outbound Direct (DHL/FedEx)',
    returnLeg: 'International Courier: Return Direct (DHL/FedEx)',
  },
}

/**
 * Domestic return leg -- CuppasCards HQ back to the customer -- via The
 * Courier Guy's Pudo Locker-to-Locker service, billed once at this rate
 * (lib/submission-pricing.ts). Customers arrange and pay for their own
 * shipping TO HQ, so that inbound leg is never charged. Replaces the old COURIERS
 * array of placeholder US carrier tiers (UPS Ground/2nd Day Air, FedEx
 * Priority Overnight) that step-review-pay.tsx used to let the customer
 * choose between -- there is no longer a choice of domestic carrier, just
 * this one real South African provider. Charged for every submission,
 * including in-person drop-offs (their cards are couriered back the same
 * way) -- same "replace once known" ballpark-figure caveat as every other
 * approximate-conversion figure in this file.
 */
export const DOMESTIC_COURIER_LABEL = 'The Courier Guy — Pudo Locker to Locker'
export const DOMESTIC_COURIER_LEG_FEE_USD = 6
export const DOMESTIC_COURIER_LEG_FEE_GBP = 5
export const DOMESTIC_COURIER_LEG_FEE_ZAR = 110

export function domesticCourierLegFeeForRegion(region: ProductRegion): number {
  if (region === 'usa') return DOMESTIC_COURIER_LEG_FEE_USD
  if (region === 'uk') return DOMESTIC_COURIER_LEG_FEE_GBP
  return DOMESTIC_COURIER_LEG_FEE_ZAR
}

/** Confirmation-email line-item labels for the domestic courier legs -- the same for Courier Delivery and In-Person Drop-Off, since both are returned via DOMESTIC_COURIER_LABEL. */
export const LOCAL_COURIER_LEG_LABELS = {
  outbound: 'Local Courier: Drop-off to HQ (arranged by customer)',
  returnLeg: 'Local Courier: Return from HQ (Pudo Locker)',
}

/**
 * Mandatory fine-art insurance via Secursus, covering the submission's cards
 * for both legs of the same international journey the courier fees above
 * cover (SA to ACE Grading's UK facility, and back) -- charged as 15% of the
 * submission's total declared card value, applied once per leg (so 30% of
 * declared value in total across both). Deliberately ZAR-only, unlike every
 * other fee in this file, which is region-parameterized (USD/GBP/ZAR): the
 * declared value it's calculated from (submission_items.declared_value,
 * summed server-side into submissions.total_declared_value by
 * app/api/submissions/route.ts) is itself always ZAR regardless of the
 * submission's region -- see PROJECT_STATE.md's Active File Manifest note on
 * GradingEmailCard.declaredValue for the same convention elsewhere in this
 * codebase -- so there is no GBP/USD figure to convert from or to.
 */
export const SECURSUS_INSURANCE_RATE = 0.15

export function secursusInsuranceLegFeeZAR(totalDeclaredValueZAR: number): number {
  return totalDeclaredValueZAR * SECURSUS_INSURANCE_RATE
}

/** Order Summary line-item labels for the two Secursus insurance legs (components/submit/step-review-pay.tsx). */
export const SECURSUS_INSURANCE_LEG_LABELS = {
  outbound: 'Secursus Insurance: Outbound to UK (15%)',
  returnLeg: 'Secursus Insurance: Return to SA (15%)',
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
  /**
   * Legacy submission-level add-ons, superseded by the per-card
   * submission_items.cleaning_tier / requires_slab_guard columns
   * (supabase/migrations/0068_per_card_add_ons.sql). New submissions always
   * store false here; kept so submissions placed before the per-card rework
   * still price at what they were charged (lib/submission-pricing.ts).
   */
  needs_clean_and_polish: boolean
  needs_semi_rigids: boolean
  requires_slab_guard: boolean
  interested_in_consignment: boolean
  /**
   * Legacy per-submission label choice (0061_add_ace_label_option.sql),
   * superseded by submission_items.ace_label_option (0069). New submissions
   * store null; 0069 copied every existing value onto its items.
   */
  ace_label_option: AceLabelOption | null
  intake_channel: IntakeChannel
  event_slug: string | null
  /** 4-digit booth handover PIN, only ever set when intake_channel = 'in_person_event'. */
  handover_pin: string | null
  /** Set once an admin verifies the handover PIN at /admin/intake -- null means "awaiting booth handover" for an in-person submission. */
  intake_verified_at: string | null
  pool_id: string | null
  pool_status: PoolStatus | null
  submission_type: SubmissionType
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
 * Per-card pre-grading clean (components/submit/step-addons.tsx), chosen
 * independently for every card and stored as submission_items.cleaning_tier
 * (supabase/migrations/0068_per_card_add_ons.sql). Prices are set by the
 * business in ZAR only -- like the Secursus insurance legs and Slab Guard,
 * there is no USD/GBP equivalent. Replaced the old submission-wide "Full
 * Clean & Polish" (flat R500) and per-card "pre-grading preparation" (R200)
 * toggles; 'half' carries over the old R200 prep price.
 */
export type CleaningTier = 'none' | 'half' | 'full'

export interface CleaningTierOption {
  value: CleaningTier
  label: string
  feeZAR: number
  /** Customer-facing copy shown under the option in the Add-ons step. */
  description: string
}

export const CLEANING_TIER_OPTIONS: CleaningTierOption[] = [
  {
    value: 'none',
    label: 'No clean',
    feeZAR: 0,
    description: 'Card is placed in a fresh sleeve and semi-rigid, then submitted exactly as received.',
  },
  {
    value: 'half',
    label: 'Half Clean',
    feeZAR: 200,
    description:
      'A meticulous surface prep using a specialized, non-abrasive card solution and optical-grade microfiber to safely remove fingerprints, light smudges, and surface dust.',
  },
  {
    value: 'full',
    label: 'Full clean',
    feeZAR: 500,
    description:
      'A comprehensive detailing pass. Includes the standard surface prep, plus careful edge and corner detailing, gentle removal of stubborn wax or mild print residue, and a high-gloss polish designed to maximize surface sub-grades.',
  },
]

export function isCleaningTier(value: unknown): value is CleaningTier {
  return CLEANING_TIER_OPTIONS.some((o) => o.value === value)
}

export function cleaningTierFeeZAR(tier: CleaningTier): number {
  return CLEANING_TIER_OPTIONS.find((o) => o.value === tier)?.feeZAR ?? 0
}

/**
 * Optional per-card "Slab Guard" add-on (components/submit/step-addons.tsx):
 * a premium protective bumper fitted to that card's returned graded slab.
 * R110 per card, ZAR only. Stored as submission_items.requires_slab_guard
 * (supabase/migrations/0068_per_card_add_ons.sql).
 */
export const SLAB_GUARD_FEE_ZAR = 110
export const SLAB_GUARD_LABEL = 'Slab Guard'

/**
 * What the retired submission-level add-ons cost, kept only so submissions
 * placed before the per-card rework (submissions.needs_clean_and_polish /
 * requires_slab_guard = true) still recompute to exactly what the customer
 * was charged -- checkout, the Payfast webhook, the confirmation email, and
 * scripts/audit-submission-payments.ts all re-price from stored rows. Never
 * offered to new submissions. Clean & Polish was region-priced (USD/GBP
 * approximate conversions, same as the rest of this file); Slab Guard was a
 * flat R95 per submission.
 */
export const LEGACY_CLEAN_AND_POLISH_FEE_USD = 27
export const LEGACY_CLEAN_AND_POLISH_FEE_GBP = 21
export const LEGACY_CLEAN_AND_POLISH_FEE_ZAR = 500
export const LEGACY_SLAB_GUARD_FEE_ZAR = 95

export function legacyCleanAndPolishFeeForRegion(region: ProductRegion): number {
  if (region === 'usa') return LEGACY_CLEAN_AND_POLISH_FEE_USD
  if (region === 'uk') return LEGACY_CLEAN_AND_POLISH_FEE_GBP
  return LEGACY_CLEAN_AND_POLISH_FEE_ZAR
}

/**
 * ACE Grading's label options -- a per-card choice
 * (components/submit/step-addons.tsx), stored as
 * submission_items.ace_label_option (supabase/migrations/0069_per_card_label_option.sql)
 * and only charged when GradingCompany is 'ACE'. Charged and displayed in
 * ZAR only (feeZAR), at ACE's own designated retail price (R25/R75).
 * feeGBP is ACE's official price the ZAR figure is set against -- kept as
 * the reference to re-derive feeZAR from if the GBP/ZAR rate moves. feeUSD
 * is the usual derived stand-in (USD = GBP / 0.79). Neither is charged.
 */
export type AceLabelOption = 'standard' | 'colour_match' | 'ace_label'

export interface LabelOptionMeta {
  value: AceLabelOption
  label: string
  feeUSD: number
  feeGBP: number
  feeZAR: number
  /** Real slab-label example photo (public/images/labels/, sourced from "Stock photos/ACE slab examples/"). */
  previewSrc: string
  /** Exact copy supplied for each label tier, shown beside its preview image. */
  description: string
}

export const ACE_LABEL_OPTIONS: LabelOptionMeta[] = [
  {
    value: 'standard',
    label: 'Standard',
    feeUSD: 0,
    feeGBP: 0,
    feeZAR: 0,
    previewSrc: '/images/labels/standard.png',
    description:
      'A clean, classic layout that displays all essential card information, set details, and the assigned grade in a traditional format.',
  },
  {
    value: 'colour_match',
    label: 'Colour Match',
    feeUSD: 1,
    feeGBP: 1,
    feeZAR: 25,
    previewSrc: '/images/labels/colour-match.png',
    description:
      "Features the same core information as the standard label, but the design and text colors are custom-printed using the two most prominent, matching colors pulled directly from the graded card's artwork.",
  },
  {
    value: 'ace_label',
    label: 'Ace Label',
    feeUSD: 4,
    feeGBP: 3,
    feeZAR: 75,
    previewSrc: '/images/labels/ace-label.png',
    description:
      'A premium, custom-illustrated label option where the artwork from the card seamlessly extends, continues, or connects onto the label itself. These unique designs are tailored to specific top-tier or community-voted cards and carry an additional fee.',
  },
]

export function isAceLabelOption(value: unknown): value is AceLabelOption {
  return ACE_LABEL_OPTIONS.some((o) => o.value === value)
}

export function labelOptionFeeZAR(option: AceLabelOption): number {
  return ACE_LABEL_OPTIONS.find((o) => o.value === option)?.feeZAR ?? 0
}

/**
 * In-person event drop-off (live card shows/conventions) -- see
 * supabase/migrations/0062_add_in_person_event_intake.sql. "Awaiting Booth
 * Handover" and "Received & Logged" are UI labels derived from
 * intake_channel + intake_verified_at below, not their own
 * SubmissionStatus values -- every submission (in-person or not) still
 * gets status = 'received' at creation, same as before this feature.
 */
export type IntakeChannel = 'online_shipment' | 'in_person_event'

export const IN_PERSON_DROPOFF_LABEL = 'In-Person Drop-Off (Table Intake)'

/** Mirrors public.event_settings's single row (0062_add_in_person_event_intake.sql). */
export interface EventSettingsRow {
  active_event_slug: string | null
  /** Human-readable display name (e.g. "Comic Con Johannesburg 2026") -- see supabase/migrations/0064_add_event_settings_name.sql. Purely cosmetic; the slug is what drives routing/matching. */
  active_event_name: string | null
  is_live: boolean
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
  /** Kept in sync with cleaning_tier (true when cleaning_tier <> 'none') for readers that predate the per-card rework. */
  pre_check_opt_in: boolean
  cleaning_tier: CleaningTier
  requires_slab_guard: boolean
  ace_label_option: AceLabelOption
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
