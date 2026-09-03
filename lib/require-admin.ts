import { NextResponse } from 'next/server'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { getSupabaseRouteClient } from './supabase-route-client'

type RequireAdminResult = { supabase: SupabaseClient; user: User } | { error: NextResponse }

/**
 * Shared guard for admin-only API routes (intake lookup/status, grading
 * queue/save). Confirms there's an authenticated session and that the
 * caller's `profiles.role` is 'admin', then hands back the same
 * session-scoped client so the route's queries keep running under Postgres
 * RLS as that user — admin access is granted by the `public.is_admin()`
 * policies from 0001_init_schema.sql, not by switching to a service-role
 * client that bypasses RLS.
 */
export async function requireAdmin(): Promise<RequireAdminResult> {
  const supabase = await getSupabaseRouteClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) }
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

  if (profile?.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) }
  }

  return { supabase, user }
}
