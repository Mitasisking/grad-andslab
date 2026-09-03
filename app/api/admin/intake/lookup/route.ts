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

  const { data: statusHistory } = await supabase
    .from('submission_status_log')
    .select('*, profiles(full_name)')
    .eq('submission_id', submission.id)
    .order('created_at', { ascending: true })

  return NextResponse.json({
    submission,
    items: items ?? [],
    statusHistory: statusHistory ?? [],
  })
}
