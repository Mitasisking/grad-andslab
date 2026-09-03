import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'

export async function GET() {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const { supabase } = auth

  const { data, error } = await supabase
    .from('submissions')
    .select('id, grading_company, qr_code_token, status, created_at')
    .in('status', ['shipped', 'graded'])
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ submissions: data })
}
