import { getSupabaseServerClient } from '@/lib/supabase-server'
import { getResendClient, getEmailFrom } from '@/lib/email/resend-client'
import { renderOrderConfirmationEmail } from '@/lib/email/templates/order-confirmation'
import {
  TIER_OPTIONS_BY_COMPANY,
  cleanAndPolishFeeForRegion,
  inspectionFeeForRegion,
  tierPriceForRegion,
} from '@/lib/submission-types'
import type { ProductRegion } from '@/lib/shop/product-type'
import type { GradingCompany, SubmissionTier } from '@/lib/submission-types'

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
async function getContact(
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
 * Fired from the Stripe webhook (app/api/webhooks/stripe/route.ts) once a
 * grading submission's PaymentIntent succeeds. Re-derives the same per-card
 * grading fee / inspection fee / Clean and Polish add-on pricing the submit
 * wizard showed at checkout (components/submit/step-review-pay.tsx) from the
 * now-persisted submission row, rather than trusting a client-supplied
 * total — the DB row is the source of truth by the time this runs.
 *
 * Best-effort: a failure here must never fail the webhook response Stripe
 * is waiting on (Stripe retries the whole event if the endpoint 500s), so
 * every call site wraps this and only logs on failure.
 */
export async function sendSubmissionConfirmationEmail(submissionId: string, receiptUrl: string | null) {
  const supabase = getSupabaseServerClient()

  const { data: submission } = await supabase
    .from('submissions')
    .select('id, user_id, grading_company, tier, region, service_fee, tax_collected, needs_clean_and_polish')
    .eq('id', submissionId)
    .single()

  if (!submission) {
    console.error('sendSubmissionConfirmationEmail: submission not found', submissionId)
    return
  }

  const { data: items } = await supabase
    .from('submission_items')
    .select('card_name, set_name, pre_check_opt_in')
    .eq('submission_id', submissionId)

  const { fullName, email } = await getContact(supabase, submission.user_id)
  if (!email) {
    console.error('sendSubmissionConfirmationEmail: no contact email on submission', submissionId)
    return
  }

  const region = submission.region as ProductRegion
  const grading_company = submission.grading_company as GradingCompany
  const tier = submission.tier as SubmissionTier
  const tierMeta = TIER_OPTIONS_BY_COMPANY[grading_company].find((t) => t.value === tier)
  const perCardFee = tierMeta ? tierPriceForRegion(tierMeta, region) : 0

  const gradingLineItems = (items ?? []).map((item) => ({
    cardName: item.card_name,
    setName: item.set_name,
    fee: perCardFee,
  }))

  const addOnLineItems: { label: string; amount: number }[] = []
  const inspectedCount = (items ?? []).filter((item) => item.pre_check_opt_in).length
  if (inspectedCount > 0) {
    addOnLineItems.push({
      label: `Pre-grading inspection × ${inspectedCount}`,
      amount: inspectedCount * inspectionFeeForRegion(region),
    })
  }
  if (submission.needs_clean_and_polish) {
    addOnLineItems.push({ label: 'Clean and Polish', amount: cleanAndPolishFeeForRegion(region) })
  }

  const { subject, html } = renderOrderConfirmationEmail({
    customerName: fullName || email,
    region,
    orderLabel: `Grading Submission #${submissionId.slice(0, 8).toUpperCase()}`,
    gradingLineItems,
    addOnLineItems,
    taxCollected: Number(submission.tax_collected ?? 0),
    total: Number(submission.service_fee ?? 0),
    receiptUrl,
  })

  await getResendClient().emails.send({ from: getEmailFrom(), to: email, subject, html })
}

/**
 * Fired from the Stripe webhook once a marketplace order's PaymentIntent
 * succeeds. Same best-effort contract as sendSubmissionConfirmationEmail
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

  await getResendClient().emails.send({ from: getEmailFrom(), to: email, subject, html })
}
