import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * Client-side Supabase client for 'use client' components. Uses
 * @supabase/ssr's createBrowserClient, not the plain @supabase/supabase-js
 * createClient -- the plain client only persists a session to localStorage,
 * which every server-side check (getSupabaseRouteClient, requireAdmin, the
 * /admin page) is blind to, since those read the session from a cookie.
 * createBrowserClient writes that same cookie on sign-in, so the session
 * this client creates is actually visible server-side.
 */
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)
