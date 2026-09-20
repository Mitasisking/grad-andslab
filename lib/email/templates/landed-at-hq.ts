import { COLORS, escapeHtml } from '@/lib/email/templates/order-confirmation'
import type { LandedAtHqPayload } from '@/types/notifications'

/**
 * Renders the LANDED_AT_HQ stage (types/notifications.ts's
 * GradingEmailStage) -- the grade reveal, once slabs are back at our HQ. No
 * current call site wires this yet (see types/notifications.ts's header
 * comment).
 *
 * "Deliver to Me" / "List on Marketplace" both link to the same dashboard
 * submission page today -- there is no dedicated return-shipping-choice
 * route yet (PROJECT_STATE.md's "Return-shipping selector doesn't exist"
 * blocked item), so this deliberately doesn't invent one; both buttons are
 * a starting point for the customer to reach us about either option rather
 * than a real fork in functionality.
 *
 * Same table-based, inline-styled HTML / COLORS palette / escapeHtml as
 * every other template in this directory.
 */
export function renderLandedAtHqEmail(payload: LandedAtHqPayload, appBaseUrl: string): { subject: string; html: string } {
  const { customer, submissionLabel, grades } = payload

  const submissionUrl = `${appBaseUrl}/dashboard/submissions`

  const gradeRows = grades
    .map(
      (g) => `
    <tr>
      <td style="padding:6px 0;font-size:14px;color:${COLORS.ink};font-family:Georgia,'Times New Roman',serif;">
        ${escapeHtml(g.cardName)} — ${escapeHtml(g.setName)}
      </td>
      <td align="right" style="padding:6px 0;font-size:14px;color:${COLORS.gold};font-family:Georgia,'Times New Roman',serif;white-space:nowrap;">
        Grade ${escapeHtml(String(g.grade))}${g.certNumber ? ` <span style="color:${COLORS.inkMuted};font-size:12px;">#${escapeHtml(g.certNumber)}</span>` : ''}
      </td>
    </tr>`,
    )
    .join('')

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
                  Your grades are in
                </h1>
                <p style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${COLORS.inkMuted};">
                  Hi ${escapeHtml(customer.name)}, your slabs have landed at our HQ — here's how they graded.
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
              <td style="padding:0 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td colspan="2" style="padding:20px 0 8px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${COLORS.gold};font-family:Arial,Helvetica,sans-serif;border-top:1px solid ${COLORS.line};">
                      Grade reveal
                    </td>
                  </tr>
                  ${gradeRows}
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px 0;text-align:center;">
                <a href="${escapeHtml(submissionUrl)}" style="display:inline-block;background:${COLORS.gold};color:${COLORS.goldInk};font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;letter-spacing:0.03em;text-decoration:none;padding:12px 24px;border-radius:3px;margin:0 6px 10px;">
                  DELIVER TO ME
                </a>
                <a href="${escapeHtml(submissionUrl)}" style="display:inline-block;background:transparent;border:1px solid ${COLORS.gold};color:${COLORS.gold};font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;letter-spacing:0.03em;text-decoration:none;padding:11px 24px;border-radius:3px;margin:0 6px 10px;">
                  LIST ON MARKETPLACE
                </a>
                <p style="margin:6px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${COLORS.inkMuted};">
                  Visit your submission to let us know which you'd prefer.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 32px;text-align:center;border-top:1px solid ${COLORS.line};">
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

  return { subject: `Your Grades Are Ready — Slabs Have Landed | CuppasCards`, html }
}
