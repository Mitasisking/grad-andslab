import crypto from 'crypto'

/**
 * Payfast integration -- our processor for the SA storefront only (Payfast
 * settles in ZAR exclusively, which lines up exactly with
 * REGION_CURRENCY.sa === 'zar' in lib/shop/product-type.ts; UK/USA keep
 * using Stripe, see the region branch in app/api/shop/checkout/route.ts and
 * app/api/submissions/checkout/route.ts).
 *
 * IMPORTANT — verify before going live: this was written against Payfast's
 * long-standing, widely-documented "Onsite/redirect" checkout flow (the
 * https://www.payfast.co.za/eng/process form-POST/GET redirect, field order
 * + MD5 signature, unchanged for years across their PHP sample code and
 * every third-party integration guide). I could not load
 * developers.payfast.co.za/api directly (it's a JS-rendered SPA my fetch
 * tooling couldn't execute) to confirm the CURRENT field list byte-for-byte
 * against this session's copy of the docs, so before processing a real
 * payment: run one full round-trip against sandbox.payfast.co.za, and
 * cross-check the field order and signature below against
 * https://developers.payfast.co.za/docs#step_1_form_fields yourself. Get
 * this wrong and Payfast will reject the payment as "signature mismatch" --
 * loudly, not silently, so sandbox testing will catch it before it costs
 * anything, but don't skip that step.
 */

export type PayfastMode = 'sandbox' | 'live'

interface PayfastConfig {
  merchantId: string
  merchantKey: string
  passphrase: string | undefined
  mode: PayfastMode
  processUrl: string
  validateUrl: string
}

export function getPayfastConfig(): PayfastConfig {
  const mode: PayfastMode = process.env.PAYFAST_MODE === 'live' ? 'live' : 'sandbox'
  const host = mode === 'live' ? 'www.payfast.co.za' : 'sandbox.payfast.co.za'

  return {
    merchantId: process.env.PAYFAST_MERCHANT_ID as string,
    merchantKey: process.env.PAYFAST_MERCHANT_KEY as string,
    passphrase: process.env.PAYFAST_PASSPHRASE || undefined,
    mode,
    processUrl: `https://${host}/eng/process`,
    validateUrl: `https://${host}/eng/query/validate`,
  }
}

/**
 * Payfast's signature is an MD5 hash of the fields joined as a
 * `key=value&key=value...` query string, in the EXACT order the fields are
 * listed in their docs (NOT alphabetical -- that's a different rule used by
 * Payfast's newer, separate subscriptions/REST API, easy to confuse this
 * with), skipping any field with an empty value, with the passphrase
 * appended as a final `&passphrase=...` pair when one is configured. Values
 * are URL-encoded PHP `urlencode()`-style: encodeURIComponent, then spaces
 * (%20) turned into literal `+`.
 */
export function payfastEncode(value: string): string {
  return encodeURIComponent(value).replace(/%20/g, '+')
}

export function buildPayfastSignature(orderedFields: [string, string | number | undefined][], passphrase?: string): string {
  const pairs = orderedFields
    .filter(([, value]) => value !== undefined && value !== null && String(value) !== '')
    .map(([key, value]) => `${key}=${payfastEncode(String(value))}`)

  if (passphrase) {
    pairs.push(`passphrase=${payfastEncode(passphrase)}`)
  }

  return crypto.createHash('md5').update(pairs.join('&')).digest('hex')
}

export interface PayfastCheckoutParams {
  /** Our own order/submission id -- round-trips back on the ITN as m_payment_id. */
  mPaymentId: string
  /** ZAR, e.g. 249.99 -- formatted to Payfast's required 2-decimal-place string internally. */
  amount: number
  itemName: string
  itemDescription?: string
  nameFirst?: string
  nameLast?: string
  emailAddress?: string
  returnUrl: string
  cancelUrl: string
  notifyUrl: string
  /**
   * custom_str1 -- carries which flow this is ('grading_submission' |
   * 'marketplace_order'), the same job Stripe's metadata.flow does
   * (app/api/webhooks/stripe/route.ts), since the ITN handler needs to know
   * which table to update.
   */
  flow: 'grading_submission' | 'marketplace_order'
}

/**
 * Builds the full redirect URL for Payfast's hosted checkout page --
 * equivalent to Stripe's PaymentIntent.client_secret, except Payfast's flow
 * is a plain redirect rather than an in-page Elements form, so the caller
 * sends the browser to `url` directly instead of confirming a payment
 * client-side.
 */
export function createPayfastCheckoutUrl(params: PayfastCheckoutParams): string {
  const config = getPayfastConfig()

  // Order matters -- this must match the field order in Payfast's own docs,
  // since the signature is computed over this exact sequence.
  const orderedFields: [string, string | number | undefined][] = [
    ['merchant_id', config.merchantId],
    ['merchant_key', config.merchantKey],
    ['return_url', params.returnUrl],
    ['cancel_url', params.cancelUrl],
    ['notify_url', params.notifyUrl],
    ['name_first', params.nameFirst],
    ['name_last', params.nameLast],
    ['email_address', params.emailAddress],
    ['m_payment_id', params.mPaymentId],
    ['amount', params.amount.toFixed(2)],
    ['item_name', params.itemName],
    ['item_description', params.itemDescription],
    ['custom_str1', params.flow],
  ]

  const signature = buildPayfastSignature(orderedFields, config.passphrase)

  const query = orderedFields
    .filter(([, value]) => value !== undefined && value !== null && String(value) !== '')
    .map(([key, value]) => `${key}=${payfastEncode(String(value))}`)
    .concat(`signature=${signature}`)
    .join('&')

  return `${config.processUrl}?${query}`
}
