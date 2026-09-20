import { sendEmail } from '@/lib/email/send-email'
import { getSupabaseServerClient } from '@/lib/supabase-server'
import { getContact } from '@/lib/email/send-order-confirmation'
import { renderOrderConfirmedEmail } from '@/lib/email/templates/order-confirmed'
import { renderCollectionBookedEmail } from '@/lib/email/templates/collection-booked'
import { renderReceivedHqEmail } from '@/lib/email/templates/received-hq'
import { renderDispatchedToGraderEmail } from '@/lib/email/templates/dispatched-to-grader'
import { renderReceivedByGraderEmail } from '@/lib/email/templates/received-by-grader'
import { renderDispatchedToSaEmail } from '@/lib/email/templates/dispatched-to-sa'
import { renderLandedAtHqEmail } from '@/lib/email/templates/landed-at-hq'
import { renderDispatchedToCustomerEmail } from '@/lib/email/templates/dispatched-to-customer'
import type { GradingCompany, ProductRegion, SubmissionTier } from '@/lib/submission-types'
import type { GradingEmailPayload } from '@/types/notifications'

/**
 * Dispatches a GradingEmailPayload (types/notifications.ts) to its stage's
 * template. All 8 stages now have real renderers -- most still have no DB
 * trigger/call site (see types/notifications.ts's header comment on why),
 * but sendGradingUpdate can be called for any of them today, including from
 * app/api/admin/simulate-lifecycle/route.ts's manual test harness.
 */
function renderGradingEmail(payload: GradingEmailPayload): { subject: string; html: string } {
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://website-three-iota-83.vercel.app'
  switch (payload.stage) {
    case 'ORDER_CONFIRMED':
      return renderOrderConfirmedEmail(payload, appBaseUrl)
    case 'COLLECTION_BOOKED':
      return renderCollectionBookedEmail(payload)
    case 'RECEIVED_HQ':
      return renderReceivedHqEmail(payload)
    case 'DISPATCHED_TO_GRADER':
      return renderDispatchedToGraderEmail(payload)
    case 'RECEIVED_BY_GRADER':
      return renderReceivedByGraderEmail(payload)
    case 'DISPATCHED_TO_SA':
      return renderDispatchedToSaEmail(payload)
    case 'LANDED_AT_HQ':
      return renderLandedAtHqEmail(payload, appBaseUrl)
    case 'DISPATCHED_TO_CUSTOMER':
      return renderDispatchedToCustomerEmail(payload)
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
 *
 * Returns the Nodemailer messageId on success -- existing callers
 * (sendOrderConfirmedEmail below, the Payfast webhook, booth-handover
 * route) all just `await` this without touching the return value, so widening
 * it from `void` doesn't change anything for them; added for
 * app/api/admin/simulate-lifecycle/route.ts's test harness, which surfaces
 * it in its response for the admin test-runner UI's console log.
 */
export async function sendGradingUpdate(payload: GradingEmailPayload): Promise<{ messageId?: string }> {
  const { subject, html } = renderGradingEmail(payload)
  const result = await sendEmail({
    to: payload.customer.email,
    subject,
    html,
  })
  if (!result.success) {
    throw new Error(result.error ?? 'sendGradingUpdate: sendEmail failed')
  }
  return { messageId: result.messageId }
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
