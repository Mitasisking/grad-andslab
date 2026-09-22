import { formatByRegion, formatZAR } from '@/lib/currency'
import { COLORS, EMAIL_LOGO_HTML, escapeHtml } from '@/lib/email/templates/order-confirmation'
import { TIER_OPTIONS_BY_COMPANY } from '@/lib/submission-types'
import type { OrderConfirmedPayload } from '@/types/notifications'

/**
 * Renders the ORDER_CONFIRMED stage of the grading notification lifecycle
 * (types/notifications.ts's GradingEmailStage) -- distinct from the
 * existing payment-receipt email (lib/email/templates/order-confirmation.ts's
 * renderOrderConfirmationEmail, sent from the Payfast webhook). That one is
 * a line-item receipt; this one is the first of 8 pipeline checkpoints and
 * focuses on what the customer needs to actually ship their cards: the
 * printable packing slip + QR code and a link to packaging guidelines. Both
 * currently fire around the same real-world moment (a submission's payment
 * completing) -- whether they should be merged into one email is a product
 * decision for whoever wires this stage's call site, not made here.
 *
 * Same table-based, inline-styled HTML as every other template in this
 * directory (see order-confirmation.ts's header comment for why: most
 * email clients ignore <style>/CSS-in-JS), reusing that file's COLORS
 * palette and escapeHtml so every transactional email stays visually and
 * securely consistent.
 */
export function renderOrderConfirmedEmail(
  payload: OrderConfirmedPayload,
  appBaseUrl: string,
): { subject: string; html: string } {
  const { customer, submissionLabel, gradingCompany, tier, region, cards, totalPaid, packingSlipUrl, qrCodeToken } =
    payload

  const tierMeta = TIER_OPTIONS_BY_COMPANY[gradingCompany].find((t) => t.value === tier)
  const tierLabel = tierMeta ? `${tierMeta.label}${tierMeta.turnaround ? ` (${tierMeta.turnaround})` : ''}` : tier
  const manifestNumber = qrCodeToken.slice(0, 8).toUpperCase()
  const guidelinesUrl = `${appBaseUrl}/prepare`

  const cardRows = cards
    .map(
      (card) => `
    <tr>
      <td style="padding:6px 0;font-size:14px;color:${COLORS.ink};font-family:Georgia,'Times New Roman',serif;">
        ${escapeHtml(card.cardName)} — ${escapeHtml(card.setName)}${card.cardNumber ? ` <span style="color:${COLORS.inkMuted};">#${escapeHtml(card.cardNumber)}</span>` : ''}
      </td>
      <td align="right" style="padding:6px 0;font-size:13px;color:${COLORS.inkMuted};font-family:Arial,Helvetica,sans-serif;white-space:nowrap;">
        ${formatZAR(card.declaredValue)}
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
                ${EMAIL_LOGO_HTML}
                <h1 style="margin:12px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:24px;color:${COLORS.ink};font-weight:normal;">
                  Your submission is confirmed
                </h1>
                <p style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${COLORS.inkMuted};">
                  Hi ${escapeHtml(customer.name)}, we've received your grading order — here's what happens next.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px 0;">
                <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${COLORS.inkMuted};">
                  ${escapeHtml(submissionLabel)} · Manifest #${escapeHtml(manifestNumber)}
                </p>
                <p style="margin:4px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${COLORS.inkMuted};">
                  ${escapeHtml(gradingCompany)} — ${escapeHtml(tierLabel)}
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td colspan="2" style="padding:20px 0 8px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${COLORS.gold};font-family:Arial,Helvetica,sans-serif;border-top:1px solid ${COLORS.line};">
                      Cards in this shipment
                    </td>
                  </tr>
                  ${cardRows}
                  <tr>
                    <td colspan="2" style="padding-top:16px;border-top:1px solid ${COLORS.line};"></td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0 0;font-size:16px;color:${COLORS.ink};font-family:Georgia,'Times New Roman',serif;">
                      Total paid
                    </td>
                    <td align="right" style="padding:8px 0 0;font-size:16px;color:${COLORS.gold};font-family:Georgia,'Times New Roman',serif;white-space:nowrap;">
                      ${formatByRegion(totalPaid, region)}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px 0;text-align:center;">
                <a href="${escapeHtml(packingSlipUrl)}" style="display:inline-block;background:${COLORS.gold};color:${COLORS.goldInk};font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;letter-spacing:0.03em;text-decoration:none;padding:12px 28px;border-radius:3px;">
                  VIEW PACKING SLIP &amp; QR CODE
                </a>
                <p style="margin:14px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${COLORS.inkMuted};">
                  Print it and place it inside your box before you ship — the QR code is how we match your cards to this submission at intake.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 32px;text-align:center;">
                <a href="${escapeHtml(guidelinesUrl)}" style="color:${COLORS.inkMuted};font-family:Arial,Helvetica,sans-serif;font-size:12px;text-decoration:underline;">
                  Read our packaging guidelines before you ship
                </a>
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

  return { subject: `CuppasCards — submission confirmed (${submissionLabel})`, html }
}
