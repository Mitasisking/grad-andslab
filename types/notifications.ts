import type { GradingCompany, ProductRegion, SubmissionTier } from '@/lib/submission-types'

/**
 * The 8-stage transactional email lifecycle for a grading submission's
 * middleman pipeline, from checkout through to the graded cards landing
 * back on the customer's doorstep. This is a notification-layer concept,
 * deliberately more granular than public.submissions.status
 * (lib/submission-types.ts's 5-stage SubmissionStatus, 'received' ->
 * 'returned') and public.shipment_batch_status (5-stage, 0052_logistics_agent_schema.sql,
 * 'preparing' -> 'completed') -- neither DB enum has a column for every one
 * of these checkpoints today (e.g. no "collection booked" or "received by
 * grader" state exists yet), so most stages beyond ORDER_CONFIRMED have no
 * current trigger/call site. Adding a stage here is not itself a promise
 * the DB tracks it -- only that lib/email/send-grading-update.ts knows how
 * to render and send it once something does.
 */
export type GradingEmailStage =
  | 'ORDER_CONFIRMED'
  | 'COLLECTION_BOOKED'
  | 'RECEIVED_HQ'
  | 'DISPATCHED_TO_GRADER'
  | 'RECEIVED_BY_GRADER'
  | 'DISPATCHED_TO_SA'
  | 'LANDED_AT_HQ'
  | 'DISPATCHED_TO_CUSTOMER'

export interface GradingEmailCustomer {
  name: string
  email: string
}

/** Mirrors the subset of SubmissionItemRow (lib/submission-types.ts) every stage needs to list. */
export interface GradingEmailCard {
  cardName: string
  setName: string
  cardNumber: string | null
  /** Always ZAR, independent of the submission's region -- components/submit/card-shipment-row.tsx's "Declared value (R)" input is ZAR-denominated regardless of region, same as submission_items.declared_value; not a region-native price like the grading fee. */
  declaredValue: number
}

/** Fields every stage's payload carries, regardless of which checkpoint fired it. */
export interface GradingEmailBase {
  customer: GradingEmailCustomer
  submissionId: string
  /** e.g. "Grading Submission #A1B2C3D4" -- same convention as OrderConfirmationEmailProps.orderLabel in lib/email/templates/order-confirmation.ts. */
  submissionLabel: string
  gradingCompany: GradingCompany
  tier: SubmissionTier
  region: ProductRegion
  cards: GradingEmailCard[]
}

export interface OrderConfirmedPayload extends GradingEmailBase {
  stage: 'ORDER_CONFIRMED'
  /** Grading fee + add-ons already summed -- mirrors submissions.service_fee. */
  totalPaid: number
  /** Caller-supplied -- components/submit/packing-slip.tsx isn't wired to a route yet, so there's no URL this type can default to on its own. */
  packingSlipUrl: string
  qrCodeToken: string
}

export interface CollectionBookedPayload extends GradingEmailBase {
  stage: 'COLLECTION_BOOKED'
  courier: string
  collectionDate: string
  waybillNumber: string
  waybillUrl: string | null
}

export interface ReceivedHqPayload extends GradingEmailBase {
  stage: 'RECEIVED_HQ'
  /** Dual-surface (front + back) inspection photos per card, taken at intake scan -- mirrors submission_items.intake_photo_url. */
  inspectionPhotos: {
    cardName: string
    frontPhotoUrl: string
    backPhotoUrl: string
  }[]
}

export interface DispatchedToGraderPayload extends GradingEmailBase {
  stage: 'DISPATCHED_TO_GRADER'
  /** public.shipment_batches.id (0052_logistics_agent_schema.sql). */
  batchId: string
  departureDate: string
  trackingNumber: string | null
}

export interface ReceivedByGraderPayload extends GradingEmailBase {
  stage: 'RECEIVED_BY_GRADER'
  receivedDate: string
  graderReferenceNumber: string | null
}

export interface DispatchedToSaPayload extends GradingEmailBase {
  stage: 'DISPATCHED_TO_SA'
  departureDate: string
  trackingNumber: string | null
  estimatedArrival: string | null
}

export interface LandedAtHqPayload extends GradingEmailBase {
  stage: 'LANDED_AT_HQ'
  /** Mirrors submission_items.grade_result / grade_cert_number. */
  grades: {
    cardName: string
    setName: string
    grade: number
    certNumber: string | null
  }[]
}

export interface DispatchedToCustomerPayload extends GradingEmailBase {
  stage: 'DISPATCHED_TO_CUSTOMER'
  courier: string
  waybillNumber: string
  trackingUrl: string | null
}

/** Discriminated on `stage` -- see lib/email/send-grading-update.ts for how each variant is dispatched to its own template. */
export type GradingEmailPayload =
  | OrderConfirmedPayload
  | CollectionBookedPayload
  | ReceivedHqPayload
  | DispatchedToGraderPayload
  | ReceivedByGraderPayload
  | DispatchedToSaPayload
  | LandedAtHqPayload
  | DispatchedToCustomerPayload
