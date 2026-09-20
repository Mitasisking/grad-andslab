import { COLORS, escapeHtml } from '@/lib/email/templates/order-confirmation'
import type { ReceivedByGraderPayload } from '@/types/notifications'

/**
 * Renders the RECEIVED_BY_GRADER stage (types/notifications.ts's
 * GradingEmailStage) -- confirms the grading company has logged the
 * customer's batch in at their facility and the grading queue has started.
 * No current call site wires this yet (see types/notifications.ts's header
 * comment).
 *
 * Same table-based, inline-styled HTML / COLORS palette / escapeHtml as
 * every other template in this directory.
 */
export function renderReceivedByGraderEmail(payload: ReceivedByGraderPayload): { subject: string; html: string } {
  const { customer, submissionLabel, gradingCompany, receivedDate, graderReferenceNumber } = payload

  const referenceRow = graderReferenceNumber
    ? `
                  <tr>
                    <td style="padding:6px 0;font-size:14px;color:${COLORS.ink};font-family:Georgia,'Times New Roman',serif;">Facility reference</td>
                    <td align="right" style="padding:6px 0;font-size:14px;color:${COLORS.ink};font-family:Georgia,'Times New Roman',serif;">${escapeHtml(graderReferenceNumber)}</td>
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
                  Logged at ${escapeHtml(gradingCompany)} Grading
                </h1>
                <p style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${COLORS.inkMuted};">
                  Hi ${escapeHtml(customer.name)}, your batch has arrived and is now in the grading queue.
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
                      Facility check-in
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;font-size:14px;color:${COLORS.ink};font-family:Georgia,'Times New Roman',serif;">Received on</td>
                    <td align="right" style="padding:6px 0;font-size:14px;color:${COLORS.ink};font-family:Georgia,'Times New Roman',serif;">${escapeHtml(receivedDate)}</td>
                  </tr>
                  ${referenceRow}
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px;">
                <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12.5px;color:${COLORS.inkMuted};line-height:1.6;">
                  Your cards are now in ${escapeHtml(gradingCompany)}'s queue. We'll email you again as soon as
                  grading is complete and your slabs begin their journey back to South Africa.
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

  return { subject: `Batch Logged at ${gradingCompany} Grading Facility | CuppasCards`, html }
}
