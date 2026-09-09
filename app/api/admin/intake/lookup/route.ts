import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'

export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const { supabase } = auth

  const token = new URL(request.url).searchParams.get('token')?.trim()
  if (!token) {
    return NextResponse.json({ error: 'A manifest token is required' }, { status: 400 })
  }

  const { data: submission, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('qr_code_token', token)
    .single()

  if (error || !submission) {
    return NextResponse.json({ error: 'No submission found for that code' }, { status: 404 })
  }

  const { data: items } = await supabase
    .from('submission_items')
    .select('*')
    .eq('submission_id', submission.id)
    .order('created_at', { ascending: true })

  // public.profiles has no foreign key relationship pointing at it anywhere
  // in production (confirmed directly against pg_constraint), so
  // PostgREST's `profiles(...)` embed syntax can never resolve here --
  // fetched as a separate batched lookup instead (same root cause and fix
  // as lib/email/send-order-confirmation.ts's getContact and
  // app/admin/pools/page.tsx).
  const { data: statusLog } = await supabase
    .from('submission_status_log')
    .select('*')
    .eq('submission_id', submission.id)
    .order('created_at', { ascending: true })

  const changedByIds = Array.from(new Set((statusLog ?? []).map((s) => s.changed_by)))
  const { data: changedByProfiles } = changedByIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', changedByIds)
    : { data: [] as { id: string; full_name: string | null }[] }
  const fullNameById = new Map((changedByProfiles ?? []).map((p) => [p.id, p.full_name]))

  const statusHistory = (statusLog ?? []).map((s) => ({
    ...s,
    profiles: { full_name: fullNameById.get(s.changed_by) ?? null },
  }))

  return NextResponse.json({
    submission,
    items: items ?? [],
    statusHistory,
  })
}
