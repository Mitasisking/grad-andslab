import { COLORS, escapeHtml } from '@/lib/email/templates/order-confirmation'
import type { ReceivedHqPayload } from '@/types/notifications'

/**
 * Renders the RECEIVED_HQ stage (types/notifications.ts's GradingEmailStage)
 * -- the customer's digital custody receipt once their cards are
 * confirmed physically in our hands. Two real call patterns produce very
 * different `inspectionPhotos`:
 *
 *  - Booth handover (app/api/admin/intake/booth-handover/route.ts): fires
 *    the instant an admin verifies a customer's PIN at a live event, before
 *    any dual-surface photos exist -- inspectionPhotos is legitimately `[]`
 *    here, not a bug, so this renders a simpler "logged, photos to follow"
 *    message rather than an empty photo grid.
 *  - A future postal-intake call site (once wired) would have real photos
 *    from app/api/admin/intake/photo already on file by the time it fires.
 *
 * Same table-based, inline-styled HTML / COLORS palette / escapeHtml as
 * every other template in this directory -- see order-confirmation.ts's
 * header comment for why (most email clients ignore <style>/CSS-in-JS).
 */
export function renderReceivedHqEmail(payload: ReceivedHqPayload): { subject: string; html: string } {
  const { customer, submissionLabel, gradingCompany, cards, inspectionPhotos } = payload

  const cardRows = cards
    .map(
      (card) => `
    <tr>
      <td style="padding:6px 0;font-size:14px;color:${COLORS.ink};font-family:Georgia,'Times New Roman',serif;">
        ${escapeHtml(card.cardName)} — ${escapeHtml(card.setName)}${card.cardNumber ? ` <span style="color:${COLORS.inkMuted};">#${escapeHtml(card.cardNumber)}</span>` : ''}
      </td>
    </tr>`,
    )
    .join('')

  const photosByCard = new Map(inspectionPhotos.map((p) => [p.cardName, p]))
  const photoSection = inspectionPhotos.length
    ? `
    <tr>
      <td colspan="2" style="padding:20px 0 8px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${COLORS.gold};font-family:Arial,Helvetica,sans-serif;border-top:1px solid ${COLORS.line};">
        Intake photos
      </td>
    </tr>
    <tr>
      <td colspan="2" style="padding:4px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            ${cards
              .filter((c) => photosByCard.has(c.cardName))
              .map((c) => {
                const photo = photosByCard.get(c.cardName)!
                return `
              <td style="padding:6px;">
                <img src="${escapeHtml(photo.frontPhotoUrl)}" width="80" height="80" style="display:block;border-radius:3px;object-fit:cover;" alt="${escapeHtml(c.cardName)} front" />
              </td>
              <td style="padding:6px;">
                <img src="${escapeHtml(photo.backPhotoUrl)}" width="80" height="80" style="display:block;border-radius:3px;object-fit:cover;" alt="${escapeHtml(c.cardName)} back" />
              </td>`
              })
              .join('')}
          </tr>
        </table>
      </td>
    </tr>`
    : `
    <tr>
      <td colspan="2" style="padding:16px 0 0;font-size:13px;color:${COLORS.inkMuted};font-family:Arial,Helvetica,sans-serif;">
        Our team will photograph each card's front and back during full intake — you'll be able
        to view those once they're taken.
      </td>
    </tr>`

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
                  Cuppa's Cards
                </p>
                <h1 style="margin:12px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:24px;color:${COLORS.ink};font-weight:normal;">
                  We have your cards
                </h1>
                <p style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${COLORS.inkMuted};">
                  Hi ${escapeHtml(customer.name)}, this is your digital custody receipt — ${escapeHtml(gradingCompany)}
                  now has your submission logged and in hand.
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
                      Cards received
                    </td>
                  </tr>
                  ${cardRows}
                  ${photoSection}
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px;text-align:center;border-top:1px solid ${COLORS.line};">
                <p style="margin:20px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${COLORS.inkMuted};">
                  Cuppa's Cards · this is an automated notification, no reply needed.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`

  return { subject: `Cuppa's Cards — we have your cards (${submissionLabel})`, html }
}
