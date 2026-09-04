import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseRouteClient } from '@/lib/supabase-route-client'
import { STATUS_STAGES } from '@/lib/submission-types'

export default async function SubmissionsListPage() {
  const supabase = await getSupabaseRouteClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // RLS (submissions_select_own_or_admin) already scopes this to the
  // caller's own rows; the explicit eq matches the pattern used everywhere
  // else in this codebase rather than relying on RLS silently alone.
  const { data: submissions } = await supabase
    .from('submissions')
    .select('id, grading_company, status, total_declared_value, qr_code_token, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div>
      <p className="text-[13px]" style={{ color: 'var(--ink-muted)' }}>
        My submissions
      </p>
      <h1 className="text-[28px] mt-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
        Track your cards
      </h1>

      {!submissions || submissions.length === 0 ? (
        <p className="text-[14px] mt-8" style={{ color: 'var(--ink-muted)' }}>
          No submissions yet.{' '}
          <Link href="/submit" className="underline underline-offset-2">
            Send some cards in
          </Link>
          .
        </p>
      ) : (
        <div className="flex flex-col mt-6 border-t" style={{ borderColor: 'var(--line)' }}>
          {submissions.map((s) => {
            const stage = STATUS_STAGES.find((stg) => stg.value === s.status)
            return (
              <Link
                key={s.id}
                href={`/dashboard/submissions/${s.id}`}
                className="flex items-center justify-between py-4 border-b gap-4"
                style={{ borderColor: 'var(--line)' }}
              >
                <div>
                  <p className="text-[14.5px]" style={{ color: 'var(--ink)' }}>
                    {s.grading_company} — #{s.qr_code_token.slice(0, 8).toUpperCase()}
                  </p>
                  <p className="text-[12.5px] mt-0.5" style={{ color: 'var(--ink-muted)' }}>
                    {new Date(s.created_at).toLocaleDateString()} · $
                    {Number(s.total_declared_value).toFixed(2)} declared
                  </p>
                </div>
                <span className="text-[13px] shrink-0" style={{ color: 'var(--seal)' }}>
                  {stage?.label ?? s.status}
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
