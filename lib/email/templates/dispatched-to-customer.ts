import { COLORS, escapeHtml } from '@/lib/email/templates/order-confirmation'
import type { DispatchedToCustomerPayload } from '@/types/notifications'

/**
 * Renders the DISPATCHED_TO_CUSTOMER stage (types/notifications.ts's
 * GradingEmailStage) -- the final checkpoint: slabs are on a domestic
 * courier headed to the customer. No current call site wires this yet (see
 * types/notifications.ts's header comment).
 *
 * Same table-based, inline-styled HTML / COLORS palette / escapeHtml as
 * every other template in this directory.
 */
export function renderDispatchedToCustomerEmail(
  payload: DispatchedToCustomerPayload,
): { subject: string; html: string } {
  const { customer, submissionLabel, courier, waybillNumber, trackingUrl } = payload

  const trackingButton = trackingUrl
    ? `
    <tr>
      <td align="center" style="padding-top:24px;">
        <a href="${escapeHtml(trackingUrl)}" style="display:inline-block;background:${COLORS.gold};color:${COLORS.goldInk};font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;letter-spacing:0.03em;text-decoration:none;padding:12px 28px;border-radius:3px;">
          TRACK MY DELIVERY
        </a>
      </td>
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
                  Your slabs are on the way
                </h1>
                <p style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${COLORS.inkMuted};">
                  Hi ${escapeHtml(customer.name)}, ${escapeHtml(courier)} is bringing your graded cards home.
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
                      Delivery details
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;font-size:14px;color:${COLORS.ink};font-family:Georgia,'Times New Roman',serif;">Courier</td>
                    <td align="right" style="padding:6px 0;font-size:14px;color:${COLORS.ink};font-family:Georgia,'Times New Roman',serif;">${escapeHtml(courier)}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;font-size:14px;color:${COLORS.ink};font-family:Georgia,'Times New Roman',serif;">Waybill</td>
                    <td align="right" style="padding:6px 0;font-size:14px;color:${COLORS.gold};font-family:Georgia,'Times New Roman',serif;">#${escapeHtml(waybillNumber)}</td>
                  </tr>
                  ${trackingButton}
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px;">
                <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12.5px;color:${COLORS.inkMuted};line-height:1.6;">
                  For security, please make sure someone is available to sign for the delivery -- graded slabs are
                  valuable and we recommend not leaving the parcel unattended at your door.
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

  return { subject: `Your Slabs Are on the Way — Waybill #${waybillNumber} | CuppasCards`, html }
}
