import { sendEmail } from '@/lib/email/send-email'
import { getSupabaseServerClient } from '@/lib/supabase-server'
import { getContact } from '@/lib/email/send-order-confirmation'
import { renderOrderConfirmedEmail } from '@/lib/email/templates/order-confirmed'
import { renderReceivedHqEmail } from '@/lib/email/templates/received-hq'
import type { GradingCompany, ProductRegion, SubmissionTier } from '@/lib/submission-types'
import type { GradingEmailPayload } from '@/types/notifications'

const UNIMPLEMENTED_STAGE_MESSAGE =
  'sendGradingUpdate: no email template implemented yet for stage'

/**
 * Dispatches a GradingEmailPayload (types/notifications.ts) to its stage's
 * template. ORDER_CONFIRMED and RECEIVED_HQ have real templates -- the
 * remaining 6 stages are typed and routable today so future work only has
 * to add a `case` + a renderer, but each currently throws rather than
 * silently sending nothing, since there's no current call site for them
 * anyway (see types/notifications.ts's header comment on why most stages
 * have no DB trigger yet).
 */
function renderGradingEmail(payload: GradingEmailPayload): { subject: string; html: string } {
  switch (payload.stage) {
    case 'ORDER_CONFIRMED': {
      const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://website-three-iota-83.vercel.app'
      return renderOrderConfirmedEmail(payload, appBaseUrl)
    }
    case 'RECEIVED_HQ':
      return renderReceivedHqEmail(payload)
    case 'COLLECTION_BOOKED':
    case 'DISPATCHED_TO_GRADER':
    case 'RECEIVED_BY_GRADER':
    case 'DISPATCHED_TO_SA':
    case 'LANDED_AT_HQ':
    case 'DISPATCHED_TO_CUSTOMER':
      throw new Error(`${UNIMPLEMENTED_STAGE_MESSAGE} "${payload.stage}"`)
  }
}

/**
 * Sends one stage of the grading notification lifecycle over Google
 * SMTP/Nodemailer (lib/email/send-email.ts). Same best-effort contract as
 * lib/email/send-order-confirmation.ts's functions: this does NOT swallow
 * its own failures -- sendEmail() itself never throws, but this re-throws
 * on `success: false` so every existing call site's try/catch (e.g. the
 * Payfast webhook, booth-handover route) keeps working unchanged. A
 * notification failure must never take down whatever pipeline event
 * triggered it, so every call site is responsible for catching this.
 */
export async function sendGradingUpdate(payload: GradingEmailPayload): Promise<void> {
  const { subject, html } = renderGradingEmail(payload)
  const result = await sendEmail({
    to: payload.customer.email,
    subject,
    html,
  })
  if (!result.success) {
    throw new Error(result.error ?? 'sendGradingUpdate: sendEmail failed')
  }
}

/**
 * Fetches everything ORDER_CONFIRMED needs and sends it for a just-paid
 * grading submission -- called from app/api/webhooks/payfast/route.ts once
 * a submission's payment_status flips to 'captured'. Same
 * fetch-then-send-best-effort shape as lib/email/send-order-confirmation.ts's
 * sendSubmissionConfirmationEmail (which already fires alongside this for
 * the same event -- that one is the line-item payment receipt, this one is
 * the "here's your packing slip and QR code" pipeline-stage email; whether
 * to eventually merge them into one send is a product decision, not made
 * here).
 *
 * Skipped entirely for intake_channel = 'in_person_event': that flow's
 * customer already sees their PIN/QR on the post-checkout dashboard page
 * (app/dashboard/submissions/[id]/submission-detail.tsx) and has nothing to
 * ship, so a "here's your packing slip" email would be actively confusing.
 *
 * Uses getSupabaseServerClient() (service-role), not a route's session
 * client -- getContact's auth.admin.getUserById call requires it (confirmed
 * the hard way: passing an RLS-scoped client here silently drops the
 * customer's email, same bug already found and fixed in
 * app/api/admin/intake/booth-handover/route.ts).
 */
export async function sendOrderConfirmedEmail(submissionId: string): Promise<void> {
  const supabase = getSupabaseServerClient()

  const { data: submission } = await supabase
    .from('submissions')
    .select('id, user_id, grading_company, tier, region, service_fee, qr_code_token, intake_channel')
    .eq('id', submissionId)
    .single()

  if (!submission) {
    console.error('sendOrderConfirmedEmail: submission not found', submissionId)
    return
  }

  if (submission.intake_channel === 'in_person_event') return

  const { data: items } = await supabase
    .from('submission_items')
    .select('card_name, set_name, card_number, declared_value')
    .eq('submission_id', submissionId)

  const { fullName, email } = await getContact(supabase, submission.user_id)
  if (!email) {
    console.error('sendOrderConfirmedEmail: no contact email for submission', submissionId)
    return
  }

  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://website-three-iota-83.vercel.app'

  await sendGradingUpdate({
    stage: 'ORDER_CONFIRMED',
    customer: { name: fullName || email, email },
    submissionId: submission.id,
    submissionLabel: `Grading Submission #${submission.id.slice(0, 8).toUpperCase()}`,
    gradingCompany: submission.grading_company as GradingCompany,
    tier: submission.tier as SubmissionTier,
    region: submission.region as ProductRegion,
    cards: (items ?? []).map((item) => ({
      cardName: item.card_name,
      setName: item.set_name,
      cardNumber: item.card_number,
      declaredValue: Number(item.declared_value ?? 0),
    })),
    totalPaid: Number(submission.service_fee ?? 0),
    // components/submit/packing-slip.tsx is still not wired to any route
    // (see types/notifications.ts's OrderConfirmedPayload doc comment) --
    // links to the existing submission detail page instead, which is real
    // and already live. Swap for a real packing-slip route if one gets built.
    packingSlipUrl: `${appBaseUrl}/dashboard/submissions/${submission.id}`,
    qrCodeToken: submission.qr_code_token,
  })
}
