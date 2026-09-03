import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { changeSubmissionStatus } from '@/lib/admin/submission-status'
import type { SubmissionStatus } from '@/lib/submission-types'

interface Body {
  submissionId: string
  status: SubmissionStatus
  /** Required by the UI for backward moves or skipped stages; optional for routine forward advances. */
  reason?: string
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const { supabase, user } = auth

  const body = (await request.json()) as Body
  if (!body.submissionId || !body.status) {
    return NextResponse.json({ error: 'submissionId and status are required' }, { status: 400 })
  }

  const result = await changeSubmissionStatus(supabase, {
    submissionId: body.submissionId,
    toStatus: body.status,
    changedBy: user.id,
    reason: body.reason,
    requestUrl: request.url,
  })

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ submission: result.submission })
}
