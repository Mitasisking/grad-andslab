import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseRouteClient } from '@/lib/supabase-route-client'

/**
 * Replaces a prior version of this page that was an exact copy-paste of
 * the old (pre-rebuild) app/dashboard/page.tsx -- same component, same
 * user_id-scoped queries against columns that don't exist (orders.grand_total,
 * submissions.card_name, profiles.street_address), and no admin gating at
 * all despite living at /admin. The real admin tools already exist at
 * /admin/grading and /admin/intake (each with their own correct role
 * check); this is just the landing page that was missing one.
 */
export default async function AdminPage() {
  const supabase = await getSupabaseRouteClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')

  return (
    <div style={{ background: 'var(--paper)', color: 'var(--ink)', minHeight: '100vh' }}>
      <div className="mx-auto max-w-3xl px-6 py-10 lg:py-16">
        <p className="text-[13px]" style={{ color: 'var(--ink-muted)' }}>
          Admin
        </p>
        <h1 className="text-[28px] mt-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
          Admin portal
        </h1>

        <div className="grid sm:grid-cols-2 gap-6 mt-8">
          <Link
            href="/admin/grading"
            className="block border rounded-[3px] p-6 hover:opacity-80 transition"
            style={{ borderColor: 'var(--line)' }}
          >
            <p className="text-[16px]" style={{ color: 'var(--ink)' }}>
              Grading portal
            </p>
            <p className="text-[13px] mt-1" style={{ color: 'var(--ink-muted)' }}>
              Advance submissions through the grading pipeline and record results.
            </p>
          </Link>

          <Link
            href="/admin/intake"
            className="block border rounded-[3px] p-6 hover:opacity-80 transition"
            style={{ borderColor: 'var(--line)' }}
          >
            <p className="text-[16px]" style={{ color: 'var(--ink)' }}>
              Intake
            </p>
            <p className="text-[13px] mt-1" style={{ color: 'var(--ink-muted)' }}>
              Look up an incoming submission by QR code and log its intake photo.
            </p>
          </Link>
        </div>
      </div>
    </div>
  )
}
