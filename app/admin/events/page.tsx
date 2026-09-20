import { redirect } from 'next/navigation'
import { getSupabaseRouteClient } from '@/lib/supabase-route-client'
import { EventSettingsPanel } from './events-settings-panel'
import type { EventSettingsRow } from '@/lib/submission-types'

export default async function AdminEventsPage() {
  const supabase = await getSupabaseRouteClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')

  const { data: settings } = await supabase
    .from('event_settings')
    .select('active_event_slug, active_event_name, is_live')
    .eq('id', true)
    .single()

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="print:hidden">
        <p className="text-[13px]" style={{ color: 'var(--ink-muted)' }}>
          Admin
        </p>
        <h1 className="text-[28px] mt-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
          Live event drop-off
        </h1>
        <p className="text-[13.5px] mt-2 max-w-lg" style={{ color: 'var(--ink-muted)' }}>
          While an event is live, every visitor to /submit gets in-person drop-off mode by default
          (free table intake, no inbound courier) even without scanning a booth QR code. A
          customer who does scan a booth code (?intake=in-person&event=slug) always gets in-person
          mode regardless of this toggle.
        </p>
      </div>

      <EventSettingsPanel
        initialSettings={(settings ?? { active_event_slug: null, active_event_name: null, is_live: false }) as EventSettingsRow}
      />
    </main>
  )
}
