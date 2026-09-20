import { NextResponse } from 'next/server'
import { getSupabaseRouteClient } from '@/lib/supabase-route-client'
import type { EventSettingsRow } from '@/lib/submission-types'

/**
 * Public, unauthenticated read of the single event_settings row
 * (0062_add_in_person_event_intake.sql) -- the /submit wizard calls this to
 * detect in-person drop-off mode when no ?intake=in-person&event=... URL
 * param is present (e.g. a customer who found the booth's tablet already
 * on the page rather than scanning a fresh QR code).
 */
export async function GET() {
  const supabase = await getSupabaseRouteClient()

  const { data } = await supabase
    .from('event_settings')
    .select('active_event_slug, active_event_name, is_live')
    .eq('id', true)
    .single()

  const settings: EventSettingsRow = data ?? { active_event_slug: null, active_event_name: null, is_live: false }
  return NextResponse.json(settings)
}
