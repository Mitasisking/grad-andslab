import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

/**
 * Server-only Supabase client using the service role key. This bypasses RLS,
 * so it must only be used from trusted server contexts that don't take a
 * user_id from client input — e.g. the Stripe webhook handler, which
 * identifies the submission via the PaymentIntent metadata Stripe itself set.
 * Never import this from a route that trusts a client-supplied identity.
 */
export function getSupabaseServerClient(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string
    client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false },
    })
  }
  return client
}
