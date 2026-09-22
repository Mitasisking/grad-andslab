import { COLORS, EMAIL_LOGO_HTML, escapeHtml } from '@/lib/email/templates/order-confirmation'
import type { CollectionBookedPayload } from '@/types/notifications'

/**
 * Renders the COLLECTION_BOOKED stage (types/notifications.ts's
 * GradingEmailStage) -- confirms a courier pickup has been scheduled for
 * the customer's submission. No current call site wires this yet (see
 * types/notifications.ts's header comment); wiring it means calling
 * sendGradingUpdate with a CollectionBookedPayload once a real pickup gets
 * scheduled.
 *
 * Same table-based, inline-styled HTML / COLORS palette / escapeHtml as
 * every other template in this directory.
 */
export function renderCollectionBookedEmail(payload: CollectionBookedPayload): { subject: string; html: string } {
  const { customer, submissionLabel, courier, collectionDate, waybillNumber, waybillUrl } = payload

  const trackingButton = waybillUrl
    ? `
    <tr>
      <td align="center" style="padding-top:24px;">
        <a href="${escapeHtml(waybillUrl)}" style="display:inline-block;background:${COLORS.gold};color:${COLORS.goldInk};font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;letter-spacing:0.03em;text-decoration:none;padding:12px 28px;border-radius:3px;">
          TRACK COLLECTION
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
                ${EMAIL_LOGO_HTML}
                <h1 style="margin:12px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:24px;color:${COLORS.ink};font-weight:normal;">
                  Courier collection booked
                </h1>
                <p style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${COLORS.inkMuted};">
                  Hi ${escapeHtml(customer.name)}, ${escapeHtml(courier)} is booked to collect your submission.
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
                      Collection details
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;font-size:14px;color:${COLORS.ink};font-family:Georgia,'Times New Roman',serif;">Courier</td>
                    <td align="right" style="padding:6px 0;font-size:14px;color:${COLORS.ink};font-family:Georgia,'Times New Roman',serif;">${escapeHtml(courier)}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;font-size:14px;color:${COLORS.ink};font-family:Georgia,'Times New Roman',serif;">Collection window</td>
                    <td align="right" style="padding:6px 0;font-size:14px;color:${COLORS.ink};font-family:Georgia,'Times New Roman',serif;">${escapeHtml(collectionDate)}</td>
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
                  Have your submission packed and ready before the collection window opens -- box it exactly as
                  described in our packaging guidelines, with the packing slip and QR code from your confirmation
                  email inside.
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

  return { subject: `Courier Collection Booked — Waybill #${waybillNumber} | CuppasCards`, html }
}
