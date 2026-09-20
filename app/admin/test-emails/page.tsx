import { redirect } from 'next/navigation'
import { getSupabaseRouteClient } from '@/lib/supabase-route-client'
import { TestEmailsPanel } from './test-emails-panel'

export default async function AdminTestEmailsPage() {
  const supabase = await getSupabaseRouteClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <p className="text-[13px]" style={{ color: 'var(--ink-muted)' }}>
        Admin
      </p>
      <h1 className="text-[28px] mt-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
        Grading lifecycle email test runner
      </h1>
      <p className="text-[13.5px] mt-2 max-w-lg" style={{ color: 'var(--ink-muted)' }}>
        Fires a real send of each of the 8 grading-notification stages (types/notifications.ts) against
        one fixed seed submission, via app/api/admin/simulate-lifecycle/route.ts. Most of these stages
        have no production trigger yet — this is a manual way to review every template&apos;s formatting
        and dynamic data in an actual inbox before any of them are wired up.
      </p>

      <TestEmailsPanel />
    </main>
  )
}
