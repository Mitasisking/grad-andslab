import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase-server'
import { getPayfastConfig, payfastEncode } from '@/lib/payments/payfast'
import { sendSubmissionConfirmationEmail, sendShopOrderConfirmationEmail } from '@/lib/email/send-order-confirmation'

/**
 * Payfast's ITN (Instant Transaction Notification) -- the SA-storefront
 * counterpart to app/api/webhooks/stripe/route.ts. SKELETON: the structural
 * pieces (signature check, the required server-to-server validate
 * call-back, DB update, confirmation email) are wired up below, but treat
 * this as a first draft, not launch-ready, until you've walked it through
 * sandbox end-to-end -- in particular:
 *
 *   - IP allowlisting: Payfast's own security checklist also expects the
 *     ITN request to be verified as actually originating from Payfast (by
 *     source IP or by resolving their known ITN hostnames), on top of the
 *     signature + validate-call checks already here. Not implemented below
 *     -- add it before this goes live. I couldn't load
 *     developers.payfast.co.za/api in this session (JS-rendered page my
 *     fetch tooling can't execute) to pull their current published IP
 *     ranges; get the current list from the dashboard/docs yourself.
 *   - This assumes payment_status is only ever 'COMPLETE' or something
 *     else terminal-ish; Payfast also sends intermediate statuses for some
 *     payment methods (e.g. EFT) -- confirm the full set in sandbox before
 *     treating "not COMPLETE" as a hard failure the way this does.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const params = new URLSearchParams(rawBody)
  const receivedSignature = params.get('signature')

  // Recompute over the RAW body (as Payfast sent it, still percent-encoded)
  // rather than decoding then re-encoding our own copy of the values --
  // that round-trip isn't guaranteed to byte-for-byte match Payfast's own
  // encoding, and the signature is defined over their literal bytes.
  const config = getPayfastConfig()
  let signatureSource = rawBody
    .split('&')
    .filter((pair) => !pair.startsWith('signature='))
    .join('&')
  if (config.passphrase) {
    signatureSource += `&passphrase=${payfastEncode(config.passphrase)}`
  }
  const expectedSignature = crypto.createHash('md5').update(signatureSource).digest('hex')

  if (!receivedSignature || expectedSignature !== receivedSignature) {
    console.error('Payfast ITN: signature mismatch', { received: receivedSignature, expected: expectedSignature })
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Required second leg: Payfast's own docs call for confirming the
  // notification with a server-to-server callback before trusting it (a
  // valid-looking signature alone isn't sufficient) -- posting the exact
  // raw body back to their /eng/query/validate endpoint and expecting the
  // literal string "VALID" back.
  let validated = false
  try {
    const validateRes = await fetch(config.validateUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: rawBody,
    })
    validated = (await validateRes.text()).trim() === 'VALID'
  } catch (err) {
    console.error('Payfast ITN: validate call failed', err)
  }

  if (!validated) {
    console.error('Payfast ITN: server-side validation with Payfast failed')
    return NextResponse.json({ error: 'Could not validate with Payfast' }, { status: 400 })
  }

  const paymentStatus = params.get('payment_status')
  const flow = params.get('custom_str1')
  const mPaymentId = params.get('m_payment_id')

  if (!flow || !mPaymentId) {
    return NextResponse.json({ received: true })
  }

  const supabase = getSupabaseServerClient()
  const succeeded = paymentStatus === 'COMPLETE'

  if (flow === 'grading_submission') {
    await supabase
      .from('submissions')
      .update({ payment_status: succeeded ? 'captured' : 'failed' })
      .eq('id', mPaymentId)

    if (succeeded) {
      // No Payfast equivalent of Stripe's charge.receipt_url -- pf_payment_id
      // (params.get('pf_payment_id')) is the closest reference number, but
      // there's no hosted receipt page to link to, so the "View receipt"
      // button in the confirmation email is simply omitted for these.
      sendSubmissionConfirmationEmail(mPaymentId, null).catch((err) =>
        console.error('Could not send submission confirmation email', mPaymentId, err),
      )
    }
  }

  if (flow === 'marketplace_order') {
    await supabase
      .from('orders')
      .update({
        status: succeeded ? 'paid' : 'cancelled',
        payment_status: succeeded ? 'captured' : 'failed',
      })
      .eq('id', mPaymentId)

    if (!succeeded) {
      await supabase.rpc('release_order_stock', { p_order_id: mPaymentId })
    } else {
      sendShopOrderConfirmationEmail(mPaymentId, null).catch((err) =>
        console.error('Could not send order confirmation email', mPaymentId, err),
      )
    }
  }

  // The auction itself already moved to 'closed' when app/api/auctions/close/
  // route.ts settled it — mPaymentId here is the winning `bids` row's id
  // (app/api/auctions/[id]/pay/route.ts), not the auction id, so this is
  // just recording whether that specific invoice got paid.
  if (flow === 'auction_invoice') {
    await supabase
      .from('bids')
      .update({ payment_status: succeeded ? 'captured' : 'failed' })
      .eq('id', mPaymentId)
  }

  return NextResponse.json({ received: true })
}
