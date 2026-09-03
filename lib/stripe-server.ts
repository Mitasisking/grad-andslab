import Stripe from 'stripe'

let stripe: Stripe | null = null

/**
 * Server-only Stripe client, constructed lazily on first use — mirrors
 * getSupabaseServerClient()'s shape. Importing a route that used to build
 * `new Stripe(...)` at module scope threw immediately if STRIPE_SECRET_KEY
 * wasn't set, which fails Next's build-time page-data collection for every
 * route in the file even though none of them had actually been invoked yet.
 */
export function getStripeClient(): Stripe {
  if (!stripe) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
      apiVersion: '2026-08-26.dahlia',
    })
  }
  return stripe
}
