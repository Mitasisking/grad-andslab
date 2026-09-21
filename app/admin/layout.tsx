import { redirect } from 'next/navigation'
import { getSupabaseRouteClient } from '@/lib/supabase-route-client'

/**
 * Gates every /admin/** route in one place. Individual admin pages
 * (app/admin/page.tsx and others) still carry their own inline
 * user/role redirect from before this layout existed -- harmless now since
 * this layout's redirect fires first and a page's own body never runs once
 * it does, but left in place rather than stripped out as an unrelated
 * cleanup. Admin access is still driven by `profiles.role = 'admin'`, the
 * same column and value `public.is_admin()` (0001_init_schema.sql) checks
 * for RLS and `lib/require-admin.ts` checks for API routes -- this layout
 * is the page-route equivalent of that same check, not a new mechanism.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await getSupabaseRouteClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/admin')
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

  if (profile?.role !== 'admin') {
    redirect('/')
  }

  return <>{children}</>
}
