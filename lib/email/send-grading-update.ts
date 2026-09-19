import { getResendClient, getEmailFrom } from '@/lib/email/resend-client'
import { renderOrderConfirmedEmail } from '@/lib/email/templates/order-confirmed'
import { renderReceivedHqEmail } from '@/lib/email/templates/received-hq'
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
 * Sends one stage of the grading notification lifecycle via Resend. Same
 * best-effort contract as lib/email/send-order-confirmation.ts's functions:
 * this does NOT catch its own errors -- a notification failure must never
 * take down whatever pipeline event triggered it, so every call site is
 * responsible for wrapping this in try/catch and only logging on failure,
 * same as the Payfast webhook already does for the existing send-* functions.
 */
export async function sendGradingUpdate(payload: GradingEmailPayload): Promise<void> {
  const { subject, html } = renderGradingEmail(payload)
  await getResendClient().emails.send({
    from: getEmailFrom(),
    to: payload.customer.email,
    subject,
    html,
  })
}
