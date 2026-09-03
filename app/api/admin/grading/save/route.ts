import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { changeSubmissionStatus } from '@/lib/admin/submission-status'

interface GradeInput {
  itemId: string
  gradeResult: number
  gradeCertNumber: string
}

interface Body {
  submissionId: string
  grades: GradeInput[]
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const { supabase, user } = auth

  const body = (await request.json()) as Body
  if (!body.submissionId || !body.grades?.length) {
    return NextResponse.json({ error: 'submissionId and at least one grade are required' }, { status: 400 })
  }

  for (const grade of body.grades) {
    const { error } = await supabase
      .from('submission_items')
      .update({
        grade_result: grade.gradeResult,
        grade_cert_number: grade.gradeCertNumber || null,
      })
      .eq('id', grade.itemId)
      .eq('submission_id', body.submissionId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  const { data: allItems } = await supabase
    .from('submission_items')
    .select('grade_result')
    .eq('submission_id', body.submissionId)

  const allGraded = (allItems ?? []).length > 0 && (allItems ?? []).every((item) => item.grade_result !== null)

  let submission = null
  if (allGraded) {
    const result = await changeSubmissionStatus(supabase, {
      submissionId: body.submissionId,
      toStatus: 'graded',
      changedBy: user.id,
      reason: 'All items graded — recorded via grading screen',
      requestUrl: request.url,
    })
    if (!('error' in result)) submission = result.submission
  }

  const { data: items } = await supabase
    .from('submission_items')
    .select('*')
    .eq('submission_id', body.submissionId)
    .order('created_at', { ascending: true })

  return NextResponse.json({ items: items ?? [], submission, autoAdvanced: allGraded })
}
