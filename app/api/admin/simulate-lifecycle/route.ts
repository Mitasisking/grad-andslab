import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { sendGradingUpdate } from '@/lib/email/send-grading-update'
import type { GradingEmailPayload, GradingEmailStage } from '@/types/notifications'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Admin-only manual test harness for the 8-stage grading notification
 * lifecycle (types/notifications.ts's GradingEmailStage, dispatched via
 * lib/email/send-grading-update.ts's sendGradingUpdate). Fires a real send
 * with one fixed, representative seed submission (order #CC-ACE-8921) so
 * every template's formatting and dynamic data can be reviewed in an actual
 * inbox -- most of these stages have no production call site yet (see
 * types/notifications.ts's header comment), so this is currently the only
 * way to see 6 of the 8 templates render against real data at all.
 *
 * `STAGE_ORDER` mirrors GradingEmailStage's declared order 1:1 so the test
 * runner UI (app/admin/test-emails/page.tsx) can address each stage by its
 * plain 1-8 position without duplicating the stage names itself.
 */
const STAGE_ORDER: GradingEmailStage[] = [
  'ORDER_CONFIRMED',
  'COLLECTION_BOOKED',
  'RECEIVED_HQ',
  'DISPATCHED_TO_GRADER',
  'RECEIVED_BY_GRADER',
  'DISPATCHED_TO_SA',
  'LANDED_AT_HQ',
  'DISPATCHED_TO_CUSTOMER',
]

const SEED = {
  submissionId: '11111111-1111-4111-8111-111111111111',
  submissionLabel: 'Grading Submission #CC-ACE-8921',
  customerName: 'Mitchell Taljaard',
  gradingCompany: 'ACE' as const,
  tier: 'ace_standard' as const,
  region: 'sa' as const,
  cards: [
    { cardName: 'Charizard ex', setName: '151', cardNumber: '199', declaredValue: 2800 },
    { cardName: 'Gengar VMAX', setName: 'Fusion Strike', cardNumber: '271', declaredValue: 4200 },
  ],
  domesticCourier: 'The Courier Guy',
  collectionWaybill: 'TCG-ZA-9948201',
  deliveryWaybill: 'TCG-ZA-9988112',
  internationalBatchRef: 'ACE-UK-2026-B04',
}

function buildStagePayload(stage: GradingEmailStage, targetEmail: string, appBaseUrl: string): GradingEmailPayload {
  const customer = { name: SEED.customerName, email: targetEmail }
  const base = {
    customer,
    submissionId: SEED.submissionId,
    submissionLabel: SEED.submissionLabel,
    gradingCompany: SEED.gradingCompany,
    tier: SEED.tier,
    region: SEED.region,
    cards: SEED.cards,
  }
  const dashboardUrl = `${appBaseUrl}/dashboard/submissions/${SEED.submissionId}`

  switch (stage) {
    case 'ORDER_CONFIRMED':
      return {
        ...base,
        stage,
        // 2 cards x ACE Standard's R590 ZAR conversion + the R500 batch-level
        // Clean & Polish add-on -- OrderConfirmedPayload has no separate
        // add-on/label-option breakdown field, so those (Colour Match label,
        // Clean & Polish line item) show up folded into this total rather
        // than itemized, a real limitation of today's payload shape, not
        // this route.
        totalPaid: 590 * SEED.cards.length + 500,
        packingSlipUrl: dashboardUrl,
        qrCodeToken: SEED.submissionId,
      }
    case 'COLLECTION_BOOKED':
      return {
        ...base,
        stage,
        courier: SEED.domesticCourier,
        collectionDate: 'Monday, 22 September 2026, 09:00 - 12:00',
        waybillNumber: SEED.collectionWaybill,
        waybillUrl: dashboardUrl,
      }
    case 'RECEIVED_HQ':
      // Real dual-surface intake photos don't exist for a simulated
      // submission -- an empty array here is the same real-world state
      // booth-handover hits before photos are taken (see
      // lib/email/templates/received-hq.ts's own header comment), not a
      // stand-in for something this route is skipping.
      return { ...base, stage, inspectionPhotos: [] }
    case 'DISPATCHED_TO_GRADER':
      return {
        ...base,
        stage,
        batchId: SEED.internationalBatchRef,
        departureDate: 'Wednesday, 24 September 2026',
        trackingNumber: null,
      }
    case 'RECEIVED_BY_GRADER':
      return {
        ...base,
        stage,
        receivedDate: 'Tuesday, 30 September 2026',
        graderReferenceNumber: SEED.internationalBatchRef,
      }
    case 'DISPATCHED_TO_SA':
      return {
        ...base,
        stage,
        departureDate: 'Friday, 9 October 2026',
        trackingNumber: null,
        estimatedArrival: 'Thursday, 15 October 2026',
      }
    case 'LANDED_AT_HQ':
      return {
        ...base,
        stage,
        grades: [
          { cardName: 'Charizard ex', setName: '151', grade: 10, certNumber: 'ACE-8921001' },
          { cardName: 'Gengar VMAX', setName: 'Fusion Strike', grade: 9, certNumber: 'ACE-8921002' },
        ],
      }
    case 'DISPATCHED_TO_CUSTOMER':
      return {
        ...base,
        stage,
        courier: SEED.domesticCourier,
        waybillNumber: SEED.deliveryWaybill,
        trackingUrl: dashboardUrl,
      }
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  let body: { stage?: unknown; targetEmail?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const { stage: rawStage, targetEmail: rawTargetEmail } = body
  const stageNumber = Number(rawStage)
  if (!Number.isInteger(stageNumber) || stageNumber < 1 || stageNumber > STAGE_ORDER.length) {
    return NextResponse.json(
      { success: false, error: `"stage" must be an integer from 1 to ${STAGE_ORDER.length}` },
      { status: 400 },
    )
  }

  if (typeof rawTargetEmail !== 'string' || !EMAIL_PATTERN.test(rawTargetEmail.trim())) {
    return NextResponse.json({ success: false, error: 'Please provide a valid "targetEmail".' }, { status: 400 })
  }
  const targetEmail = rawTargetEmail.trim()

  const stage = STAGE_ORDER[stageNumber - 1]
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://website-three-iota-83.vercel.app'
  const payload = buildStagePayload(stage, targetEmail, appBaseUrl)

  try {
    const { messageId } = await sendGradingUpdate(payload)
    return NextResponse.json({ success: true, stage, stageNumber, messageId })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Send failed'
    return NextResponse.json({ success: false, stage, stageNumber, error: message }, { status: 502 })
  }
}
