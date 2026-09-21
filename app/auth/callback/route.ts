import { NextResponse } from 'next/server'
import { getSupabaseRouteClient } from '@/lib/supabase-route-client'

/**
 * OAuth callback for Supabase Auth's Google/Apple sign-in
 * (app/login/page.tsx and app/signup/page.tsx call supabase.auth.signInWithOAuth
 * with redirectTo pointing here). Exchanges the ?code= Supabase's own auth
 * server appends for a real session, persisted via getSupabaseRouteClient's
 * cookie handlers -- the same client every other route handler in this app
 * already uses, so the session created here is immediately visible to
 * server-side checks (requireAdmin, the /admin pages, getSupabaseRouteClient
 * itself elsewhere) without a second, parallel cookie-handling
 * implementation to keep in sync with that one.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await getSupabaseRouteClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth_exchange_failed`)
}
