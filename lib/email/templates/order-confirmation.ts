import { formatByRegion } from '@/lib/currency'
import type { ProductRegion } from '@/lib/shop/product-type'

export interface ShopLineItem {
  title: string
  quantity: number
  unitPrice: number
}

export interface GradingLineItem {
  cardName: string
  setName: string
  fee: number
}

export interface AddOnLineItem {
  label: string
  amount: number
}

export interface OrderConfirmationEmailProps {
  customerName: string
  region: ProductRegion
  /** e.g. "Order #A1B2C3D4" or "Grading Submission #A1B2C3D4". */
  orderLabel: string
  shopLineItems?: ShopLineItem[]
  gradingLineItems?: GradingLineItem[]
  /** e.g. the R500 Clean and Polish add-on, or per-card pre-grading inspection. */
  addOnLineItems?: AddOnLineItem[]
  shippingCost?: number
  taxCollected?: number
  total: number
  /** Stripe charge.receipt_url, when available — links straight to Stripe's hosted receipt. */
  receiptUrl?: string | null
}

const COLORS = {
  bg: '#120f0b',
  panel: '#1d1812',
  ink: '#f3efe4',
  inkMuted: '#a99f8c',
  gold: '#d4a24c',
  goldInk: '#1c1408',
  line: '#332c22',
}

function money(amount: number, region: ProductRegion) {
  return formatByRegion(amount, region)
}

function row(label: string, value: string, opts?: { muted?: boolean }) {
  return `
    <tr>
      <td style="padding:6px 0;font-size:14px;color:${opts?.muted ? COLORS.inkMuted : COLORS.ink};font-family:Georgia,'Times New Roman',serif;">${label}</td>
      <td align="right" style="padding:6px 0;font-size:14px;color:${opts?.muted ? COLORS.inkMuted : COLORS.ink};font-family:Georgia,'Times New Roman',serif;white-space:nowrap;">${value}</td>
    </tr>`
}

/**
 * Renders a branded (black/gold, matching app/globals.css's --paper/--seal
 * palette) HTML order-confirmation email. Table-based layout with inline
 * styles throughout, deliberately -- most email clients (Outlook especially)
 * ignore <style> blocks and modern CSS, so this can't rely on Tailwind or
 * CSS custom properties the way the rest of the app does.
 */
export function renderOrderConfirmationEmail(props: OrderConfirmationEmailProps): { subject: string; html: string } {
  const {
    customerName,
    region,
    orderLabel,
    shopLineItems = [],
    gradingLineItems = [],
    addOnLineItems = [],
    shippingCost = 0,
    taxCollected = 0,
    total,
    receiptUrl,
  } = props

  const shopRows = shopLineItems
    .map((item) => row(`${item.title} × ${item.quantity}`, money(item.unitPrice * item.quantity, region)))
    .join('')

  const gradingRows = gradingLineItems
    .map((item) => row(`${item.cardName} — ${item.setName}`, money(item.fee, region)))
    .join('')

  const addOnRows = addOnLineItems.map((item) => row(item.label, money(item.amount, region))).join('')

  const sectionTitle = (title: string) => `
    <tr>
      <td colspan="2" style="padding:20px 0 8px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${COLORS.gold};font-family:Arial,Helvetica,sans-serif;border-top:1px solid ${COLORS.line};">
        ${title}
      </td>
    </tr>`

  const sections = [
    shopLineItems.length ? sectionTitle('Shop items') + shopRows : '',
    gradingLineItems.length ? sectionTitle('Grading submission') + gradingRows : '',
    addOnLineItems.length ? sectionTitle('Add-ons') + addOnRows : '',
  ].join('')

  const totalsRows = [
    shippingCost > 0 ? row('Shipping', money(shippingCost, region), { muted: true }) : '',
    taxCollected > 0 ? row('Tax', money(taxCollected, region), { muted: true }) : '',
  ].join('')

  const receiptButton = receiptUrl
    ? `
    <tr>
      <td colspan="2" align="center" style="padding-top:28px;">
        <a href="${receiptUrl}" style="display:inline-block;background:${COLORS.gold};color:${COLORS.goldInk};font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;letter-spacing:0.03em;text-decoration:none;padding:12px 28px;border-radius:3px;">
          VIEW RECEIPT
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
                  Cuppa Cards
                </p>
                <h1 style="margin:12px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:24px;color:${COLORS.ink};font-weight:normal;">
                  Payment received
                </h1>
                <p style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${COLORS.inkMuted};">
                  Hi ${customerName}, thanks for your payment — here's your confirmation.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px 0;">
                <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${COLORS.inkMuted};">
                  ${orderLabel}
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  ${sections}
                  ${totalsRows ? sectionTitle('') + totalsRows : ''}
                  <tr>
                    <td colspan="2" style="padding-top:12px;border-top:1px solid ${COLORS.line};"></td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0 0;font-size:16px;color:${COLORS.ink};font-family:Georgia,'Times New Roman',serif;">
                      Total paid
                    </td>
                    <td align="right" style="padding:8px 0 0;font-size:16px;color:${COLORS.gold};font-family:Georgia,'Times New Roman',serif;white-space:nowrap;">
                      ${money(total, region)}
                    </td>
                  </tr>
                  ${receiptButton}
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;text-align:center;">
                <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${COLORS.inkMuted};">
                  Cuppa Cards · this is an automated receipt, no reply needed.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`

  return { subject: `Cuppa Cards — payment confirmed (${orderLabel})`, html }
}
