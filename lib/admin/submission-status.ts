import type { SupabaseClient } from '@supabase/supabase-js'
import type { SubmissionStatus } from '@/lib/submission-types'

const NOTIFY_COPY: Record<SubmissionStatus, string> = {
  received: 'Your package has arrived at intake.',
  inspected: 'Your cards have been inspected and are queued for the grader.',
  shipped: 'Your submission has shipped to the grading company.',
  graded: 'Grading is complete — your results are ready to view.',
  returned: 'Your cards are on their way back to you.',
}

interface ChangeStatusInput {
  submissionId: string
  toStatus: SubmissionStatus
  changedBy: string
  reason?: string
  /** The current request's URL, used to build a same-origin call to /api/notify. */
  requestUrl: string
}

type ChangeStatusResult = { submission: { id: string; user_id: string; status: SubmissionStatus } } | { error: string }

/**
 * Applies a status transition, whatever the direction — this is used both
 * for routine forward progression and for admin overrides (backward moves,
 * skipped stages). Every call writes a submission_status_log row, so an
 * override is always attributable and reasoned, never silent.
 */
export async function changeSubmissionStatus(
  supabase: SupabaseClient,
  input: ChangeStatusInput,
): Promise<ChangeStatusResult> {
  const { data: current, error: fetchError } = await supabase
    .from('submissions')
    .select('id, user_id, status')
    .eq('id', input.submissionId)
    .single()

  if (fetchError || !current) {
    return { error: fetchError?.message ?? 'Submission not found' }
  }

  const { data: updated, error: updateError } = await supabase
    .from('submissions')
    .update({ status: input.toStatus })
    .eq('id', input.submissionId)
    .select('id, user_id, status')
    .single()

  if (updateError || !updated) {
    return { error: updateError?.message ?? 'Could not update status' }
  }

  await supabase.from('submission_status_log').insert({
    submission_id: input.submissionId,
    from_status: current.status,
    to_status: input.toStatus,
    changed_by: input.changedBy,
    reason: input.reason ?? null,
  })

  // Best-effort: a failed notification shouldn't undo a status change that
  // already saved and was already logged above.
  try {
    await fetch(new URL('/api/notify', input.requestUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: updated.user_id, message: NOTIFY_COPY[input.toStatus] }),
    })
  } catch {
    // logged server-side by /api/notify itself
  }

  return { submission: updated }
}
