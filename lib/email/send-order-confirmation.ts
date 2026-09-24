import { getSupabaseServerClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/email/send-email'
import { renderOrderConfirmationEmail, COLORS, EMAIL_LOGO_HTML, escapeHtml } from '@/lib/email/templates/order-confirmation'
import { formatZAR } from '@/lib/currency'
import {
  ACE_LABEL_OPTIONS,
  INTERNATIONAL_COURIER_LEG_LABELS,
  LOCAL_COURIER_LEG_LABELS,
  LOCAL_IN_PERSON_LEG_LABELS,
  SECURSUS_INSURANCE_LEG_LABELS,
  SLAB_GUARD_LABEL,
  TIER_OPTIONS_BY_COMPANY,
  tierPriceForRegion,
} from '@/lib/submission-types'
import {
  SUBMISSION_ITEM_PRICING_COLUMNS,
  SUBMISSION_PRICING_COLUMNS,
  computeSubmissionPricing,
  pricingInputFromRows,
} from '@/lib/submission-pricing'
import type { SubmissionItemPricingRow, SubmissionPricing, SubmissionPricingRow } from '@/lib/submission-pricing'
import type { ProductRegion } from '@/lib/shop/product-type'

/**
 * public.profiles has NO foreign key relationship pointing at it anywhere
 * in the production database (confirmed directly: zero rows from
 * `pg_constraint where confrelid = 'public.profiles'::regclass`), so
 * PostgREST's embedded-resource syntax -- `.select('..., profiles(...)')`,
 * used throughout this codebase -- can never resolve for it; it always
 * fails with PGRST200 ("Could not find a relationship"), independent of
 * which columns are requested. profiles also has no email column at all
 * (0040_fix_handle_new_user_missing_email_column.sql) -- the live table
 * predates the migration history describing it and was never reconciled.
 *
 * So this fetches full_name and email as two plain, un-embedded lookups:
 * full_name via a direct profiles query (works fine without an FK -- only
 * the embed syntax needs one), and email via the Admin API against
 * auth.users, which is the sanctioned way to read a real email address
 * server-side regardless of what profiles.email ends up being long-term.
 */
export async function getContact(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  userId: string,
): Promise<{ fullName: string | null; email: string | null }> {
  const [profileResult, userResult] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', userId).single(),
    supabase.auth.admin.getUserById(userId),
  ])
  if (profileResult.error) {
    console.error('Could not look up profile', userId, profileResult.error.message)
  }
  if (userResult.error) {
    console.error('Could not look up user email', userId, userResult.error.message)
  }
  return {
    fullName: profileResult.data?.full_name ?? null,
    email: userResult.data.user?.email ?? null,
  }
}

/**
 * Fired from the Payfast ITN webhook (app/api/webhooks/payfast/route.ts)
 * once a grading submission's payment completes. Re-derives the same
 * per-card grading fee / inspection fee / Clean and Polish add-on pricing
 * the submit wizard showed at checkout (components/submit/step-review-pay.tsx)
 * from the now-persisted submission row, rather than trusting a
 * client-supplied total — the DB row is the source of truth by the time
 * this runs.
 *
 * Best-effort: a failure here must never fail the webhook response Payfast
 * is waiting on, so every call site wraps this and only logs on failure.
 */
export async function sendSubmissionConfirmationEmail(submissionId: string, receiptUrl: string | null) {
  const supabase = getSupabaseServerClient()

  const { data: submission } = await supabase
    .from('submissions')
    .select(`id, user_id, service_fee, tax_collected, ${SUBMISSION_PRICING_COLUMNS}`)
    .eq('id', submissionId)
    .single()

  if (!submission) {
    console.error('sendSubmissionConfirmationEmail: submission not found', submissionId)
    return
  }

  const { data: items } = await supabase
    .from('submission_items')
    .select(`card_name, set_name, ${SUBMISSION_ITEM_PRICING_COLUMNS}`)
    .eq('submission_id', submissionId)

  const { fullName, email } = await getContact(supabase, submission.user_id)
  if (!email) {
    console.error('sendSubmissionConfirmationEmail: no contact email on submission', submissionId)
    return
  }

  const pricingRow = submission as unknown as SubmissionPricingRow
  const region = pricingRow.region
  const cardRows = (items ?? []) as unknown as (SubmissionItemPricingRow & { card_name: string; set_name: string })[]

  // Every amount comes from the same computeSubmissionPricing() the Review &
  // Pay step and the Payfast webhook use, so the email always matches what
  // was charged. Courier and insurance stay itemised per leg here (the
  // on-screen Order Summary shows each as one round-trip line) because
  // this email doubles as the customer's invoice.
  let pricing: SubmissionPricing | null = null
  try {
    pricing = computeSubmissionPricing(pricingInputFromRows(pricingRow, cardRows))
  } catch (err) {
    console.error('sendSubmissionConfirmationEmail: could not price submission', submissionId, err)
  }

  const tierMeta = TIER_OPTIONS_BY_COMPANY[pricingRow.grading_company]?.find((t) => t.value === pricingRow.tier)
  const perCardFee = pricing?.perCardFee ?? (tierMeta ? tierPriceForRegion(tierMeta, region) : 0)

  const gradingLineItems = cardRows.map((item) => ({
    cardName: item.card_name,
    setName: item.set_name,
    fee: perCardFee,
  }))

  const addOnLineItems: { label: string; amount: number }[] = []
  const feeLineItems: { label: string; amount: number }[] = []
  if (pricing) {
    if (pricingRow.grading_company === 'ACE') {
      const labelMeta = ACE_LABEL_OPTIONS.find((o) => o.value === pricingRow.ace_label_option) ?? ACE_LABEL_OPTIONS[0]
      addOnLineItems.push({ label: `${labelMeta.label} label × ${cardRows.length}`, amount: pricing.labelOptionSubtotal })
    }
    if (pricingRow.needs_clean_and_polish) {
      addOnLineItems.push({ label: 'Clean and Polish', amount: pricing.cuppasServicesSubtotal })
    } else if (pricing.cardsWithPrepCount > 0) {
      addOnLineItems.push({ label: `Pre-grading inspection × ${pricing.cardsWithPrepCount}`, amount: pricing.cuppasServicesSubtotal })
    }
    if (pricing.slabGuardSubtotal > 0) {
      addOnLineItems.push({ label: SLAB_GUARD_LABEL, amount: pricing.slabGuardSubtotal })
    }

    // Only the return leg is charged -- customers ship to HQ themselves.
    const inPerson = pricingRow.intake_channel === 'in_person_event'
    const internationalLabels = INTERNATIONAL_COURIER_LEG_LABELS[pricingRow.submission_type ?? 'batch']
    feeLineItems.push(
      {
        label: inPerson ? LOCAL_IN_PERSON_LEG_LABELS.returnLeg : LOCAL_COURIER_LEG_LABELS.returnLeg,
        amount: pricing.localCourierTotal,
      },
      { label: internationalLabels.outbound, amount: pricing.internationalLegFee },
      { label: internationalLabels.returnLeg, amount: pricing.internationalLegFee },
      { label: SECURSUS_INSURANCE_LEG_LABELS.outbound, amount: pricing.secursusInsuranceLegFee },
      { label: SECURSUS_INSURANCE_LEG_LABELS.returnLeg, amount: pricing.secursusInsuranceLegFee },
    )
  }

  const { subject, html } = renderOrderConfirmationEmail({
    customerName: fullName || email,
    region,
    orderLabel: `Grading Submission #${submissionId.slice(0, 8).toUpperCase()}`,
    gradingLineItems,
    addOnLineItems,
    feeLineItems,
    taxCollected: Number(submission.tax_collected ?? 0),
    total: pricing?.total ?? Number(submission.service_fee ?? 0),
    receiptUrl,
  })

  const result = await sendEmail({ to: email, subject, html })
  if (!result.success) throw new Error(result.error ?? 'sendSubmissionConfirmationEmail: sendEmail failed')
}

/**
 * Fired from the Payfast ITN webhook once a marketplace order's payment
 * completes. Same best-effort contract as sendSubmissionConfirmationEmail
 * above.
 */
export async function sendShopOrderConfirmationEmail(orderId: string, receiptUrl: string | null) {
  const supabase = getSupabaseServerClient()

  const { data: order } = await supabase
    .from('orders')
    .select('id, user_id, region, subtotal, shipping_cost, total')
    .eq('id', orderId)
    .single()

  if (!order) {
    console.error('sendShopOrderConfirmationEmail: order not found', orderId)
    return
  }

  const { data: items } = await supabase
    .from('order_items')
    .select('title, unit_price, quantity')
    .eq('order_id', orderId)

  const { fullName, email } = await getContact(supabase, order.user_id)
  if (!email) {
    console.error('sendShopOrderConfirmationEmail: no contact email on order', orderId)
    return
  }

  const shopLineItems = (items ?? []).map((item) => ({
    title: item.title,
    quantity: item.quantity,
    unitPrice: Number(item.unit_price),
  }))

  const { subject, html } = renderOrderConfirmationEmail({
    customerName: fullName || email,
    region: order.region as ProductRegion,
    orderLabel: `Order #${orderId.slice(0, 8).toUpperCase()}`,
    shopLineItems,
    shippingCost: Number(order.shipping_cost ?? 0),
    total: Number(order.total ?? 0),
    receiptUrl,
  })

  const result = await sendEmail({ to: email, subject, html })
  if (!result.success) throw new Error(result.error ?? 'sendShopOrderConfirmationEmail: sendEmail failed')
}

/**
 * Fired from app/api/auctions/close/route.ts once an auction closes with
 * its reserve met — the "pending invoice" step the cron produces in place
 * of the old Stripe hold-capture. There's no payment yet at this point
 * (Payfast has no pre-auth to capture); this just tells the winner what
 * they owe and links back to the auction page, where BidForm shows a
 * "Pay now" button that calls app/api/auctions/[id]/pay/route.ts to get an
 * actual Payfast redirect. Best-effort, same contract as the two functions
 * above — never allowed to fail the cron response.
 */
export async function sendAuctionWonEmail(auctionId: string) {
  const supabase = getSupabaseServerClient()

  const { data: auction } = await supabase
    .from('auctions')
    .select('id, title, current_high_bid, current_high_bidder_id')
    .eq('id', auctionId)
    .single()

  if (!auction || !auction.current_high_bidder_id || auction.current_high_bid === null) {
    console.error('sendAuctionWonEmail: auction not found or has no winner', auctionId)
    return
  }

  const { fullName, email } = await getContact(supabase, auction.current_high_bidder_id)
  if (!email) {
    console.error('sendAuctionWonEmail: no contact email for winning bidder', auctionId)
    return
  }

  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://website-three-iota-83.vercel.app'
  const payUrl = `${appBaseUrl}/auctions/${auction.id}`
  const amount = formatZAR(Number(auction.current_high_bid))
  const customerName = fullName || email

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
                  You won the auction
                </h1>
                <p style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${COLORS.inkMuted};">
                  Hi ${escapeHtml(customerName)}, your bid was the highest when bidding closed on:
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 0;text-align:center;">
                <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:17px;color:${COLORS.ink};">
                  ${escapeHtml(auction.title)}
                </p>
                <p style="margin:10px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:${COLORS.gold};">
                  ${amount}
                </p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:28px 32px 32px;">
                <a href="${escapeHtml(payUrl)}" style="display:inline-block;background:${COLORS.gold};color:${COLORS.goldInk};font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;letter-spacing:0.03em;text-decoration:none;padding:12px 28px;border-radius:3px;">
                  PAY NOW
                </a>
                <p style="margin:14px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${COLORS.inkMuted};">
                  This invoice hasn't been paid yet — follow the link above to settle it via Payfast.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`

  const result = await sendEmail({
    to: email,
    subject: `CuppasCards — you won "${auction.title}"`,
    html,
  })
  if (!result.success) throw new Error(result.error ?? 'sendAuctionWonEmail: sendEmail failed')
}
