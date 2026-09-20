import { COLORS, escapeHtml } from '@/lib/email/templates/order-confirmation'
import type { DispatchedToSaPayload } from '@/types/notifications'

/**
 * Renders the DISPATCHED_TO_SA stage (types/notifications.ts's
 * GradingEmailStage) -- confirms grading is complete and the now-slabbed
 * cards are in transit back to South Africa. No current call site wires
 * this yet (see types/notifications.ts's header comment).
 *
 * Same table-based, inline-styled HTML / COLORS palette / escapeHtml as
 * every other template in this directory.
 */
export function renderDispatchedToSaEmail(payload: DispatchedToSaPayload): { subject: string; html: string } {
  const { customer, submissionLabel, gradingCompany, departureDate, trackingNumber, estimatedArrival } = payload

  const trackingRow = trackingNumber
    ? `
                  <tr>
                    <td style="padding:6px 0;font-size:14px;color:${COLORS.ink};font-family:Georgia,'Times New Roman',serif;">Return airway bill</td>
                    <td align="right" style="padding:6px 0;font-size:14px;color:${COLORS.ink};font-family:Georgia,'Times New Roman',serif;">${escapeHtml(trackingNumber)}</td>
                  </tr>`
    : ''

  const arrivalRow = estimatedArrival
    ? `
                  <tr>
                    <td style="padding:6px 0;font-size:14px;color:${COLORS.ink};font-family:Georgia,'Times New Roman',serif;">Estimated arrival</td>
                    <td align="right" style="padding:6px 0;font-size:14px;color:${COLORS.ink};font-family:Georgia,'Times New Roman',serif;">${escapeHtml(estimatedArrival)}</td>
                  </tr>`
    : ''

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:${COLORS.bg};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.bg};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:${COLORS.panel};border:1px solid ${COLORS.line};border-radius:4px;">
            <tr>
              <td style="padding:32px 32px 0;text-align:center;">
                <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.18em;color:${COLORS.gold};text-transform:uppercase;">
                  CuppasCards
                </p>
                <h1 style="margin:12px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:24px;color:${COLORS.ink};font-weight:normal;">
                  Grading complete — heading home
                </h1>
                <p style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${COLORS.inkMuted};">
                  Hi ${escapeHtml(customer.name)}, ${escapeHtml(gradingCompany)} has finished grading and your slabs
                  are now in transit back to South Africa.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px 0;">
                <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${COLORS.inkMuted};">
                  ${escapeHtml(submissionLabel)}
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td colspan="2" style="padding:20px 0 8px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${COLORS.gold};font-family:Arial,Helvetica,sans-serif;border-top:1px solid ${COLORS.line};">
                      Inbound transit
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;font-size:14px;color:${COLORS.ink};font-family:Georgia,'Times New Roman',serif;">Departure date</td>
                    <td align="right" style="padding:6px 0;font-size:14px;color:${COLORS.ink};font-family:Georgia,'Times New Roman',serif;">${escapeHtml(departureDate)}</td>
                  </tr>
                  ${trackingRow}
                  ${arrivalRow}
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px;">
                <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12.5px;color:${COLORS.inkMuted};line-height:1.6;">
                  Your cards are encapsulated and clearing customs on their way back to our Swellendam HQ. We'll
                  email you the grade reveal as soon as they land.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px;text-align:center;border-top:1px solid ${COLORS.line};">
                <p style="margin:20px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${COLORS.inkMuted};">
                  CuppasCards · this is an automated notification, no reply needed.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`

  return { subject: `Grading Complete — Inbound to South Africa | CuppasCards`, html }
}
