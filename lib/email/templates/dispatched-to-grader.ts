import { COLORS, escapeHtml } from '@/lib/email/templates/order-confirmation'
import { TIER_OPTIONS_BY_COMPANY } from '@/lib/submission-types'
import type { DispatchedToGraderPayload } from '@/types/notifications'

/**
 * Renders the DISPATCHED_TO_GRADER stage (types/notifications.ts's
 * GradingEmailStage) -- confirms the customer's batch has left our HQ for
 * the grading company's international facility. No current call site wires
 * this yet (see types/notifications.ts's header comment); wiring it means
 * calling sendGradingUpdate with a DispatchedToGraderPayload once
 * public.shipment_batches (0052_logistics_agent_schema.sql) marks a batch
 * as departed.
 *
 * Same table-based, inline-styled HTML / COLORS palette / escapeHtml as
 * every other template in this directory.
 */
export function renderDispatchedToGraderEmail(payload: DispatchedToGraderPayload): { subject: string; html: string } {
  const { customer, submissionLabel, gradingCompany, tier, batchId, departureDate, trackingNumber } = payload

  const tierMeta = TIER_OPTIONS_BY_COMPANY[gradingCompany].find((t) => t.value === tier)
  const turnaround = tierMeta?.turnaround ?? null

  const trackingRow = trackingNumber
    ? `
                  <tr>
                    <td style="padding:6px 0;font-size:14px;color:${COLORS.ink};font-family:Georgia,'Times New Roman',serif;">Tracking number</td>
                    <td align="right" style="padding:6px 0;font-size:14px;color:${COLORS.ink};font-family:Georgia,'Times New Roman',serif;">${escapeHtml(trackingNumber)}</td>
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
                  On its way to ${escapeHtml(gradingCompany)} Grading
                </h1>
                <p style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${COLORS.inkMuted};">
                  Hi ${escapeHtml(customer.name)}, your batch has departed for international transit.
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
                      Dispatch details
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;font-size:14px;color:${COLORS.ink};font-family:Georgia,'Times New Roman',serif;">Batch reference</td>
                    <td align="right" style="padding:6px 0;font-size:14px;color:${COLORS.gold};font-family:Georgia,'Times New Roman',serif;">#${escapeHtml(batchId)}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;font-size:14px;color:${COLORS.ink};font-family:Georgia,'Times New Roman',serif;">Departure date</td>
                    <td align="right" style="padding:6px 0;font-size:14px;color:${COLORS.ink};font-family:Georgia,'Times New Roman',serif;">${escapeHtml(departureDate)}</td>
                  </tr>
                  ${trackingRow}
                  ${
                    turnaround
                      ? `
                  <tr>
                    <td style="padding:6px 0;font-size:14px;color:${COLORS.ink};font-family:Georgia,'Times New Roman',serif;">Estimated turnaround</td>
                    <td align="right" style="padding:6px 0;font-size:14px;color:${COLORS.ink};font-family:Georgia,'Times New Roman',serif;">${escapeHtml(turnaround)}, once received by the grader</td>
                  </tr>`
                      : ''
                  }
                </table>
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

  return { subject: `Dispatched to ${gradingCompany} Grading — Batch #${batchId} | CuppasCards`, html }
}
