import { Resend } from 'resend'

let client: Resend | null = null

/**
 * Server-only Resend client, constructed lazily on first use -- mirrors
 * getStripeClient() (lib/stripe-server.ts): building it at module scope
 * would throw immediately if RESEND_API_KEY isn't set, which fails Next's
 * build-time page-data collection for every route in the file even though
 * none of them had actually sent an email yet.
 */
export function getResendClient(): Resend {
  if (!client) {
    client = new Resend(process.env.RESEND_API_KEY as string)
  }
  return client
}

/**
 * `updates@cuppacards.com` is the default "from" for every transactional
 * email so there's one sender identity across the app, unless a specific
 * env var overrides it (e.g. for a receipts@ subdomain once one is verified
 * in Resend). Must be a domain verified in the Resend dashboard, or sends
 * will fail.
 */
export function getEmailFrom(): string {
  return process.env.EMAIL_FROM ?? 'Cuppa Cards <updates@cuppacards.com>'
}
