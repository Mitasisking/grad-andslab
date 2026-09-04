'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { SubmissionRow, SubmissionItemRow } from '@/lib/submission-types'

/**
 * Keeps one submission's status and its item list live: the initial
 * server-fetched data renders immediately (no loading flash), then this
 * subscribes to Postgres changes scoped to that one submission id — an
 * UPDATE on `submissions` (status advances through the pipeline, per
 * lib/admin/submission-status.ts's changeSubmissionStatus) and UPDATEs on
 * `submission_items` (grade_result from admin/grading/save, hi_res_photo_url
 * from admin/intake/photo-confirm). Items are never inserted after the
 * initial submission — only ever updated — so only UPDATE is subscribed.
 */
export function useRealtimeSubmission(initialSubmission: SubmissionRow, initialItems: SubmissionItemRow[]) {
  const [submission, setSubmission] = useState(initialSubmission)
  const [items, setItems] = useState(initialItems)

  useEffect(() => {
    setSubmission(initialSubmission)
  }, [initialSubmission])

  useEffect(() => {
    setItems(initialItems)
  }, [initialItems])

  useEffect(() => {
    const submissionId = initialSubmission.id

    const channel = supabase
      .channel(`submission:${submissionId}`)
      .on<SubmissionRow>(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'submissions', filter: `id=eq.${submissionId}` },
        (payload) => setSubmission(payload.new),
      )
      .on<SubmissionItemRow>(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'submission_items', filter: `submission_id=eq.${submissionId}` },
        (payload) => setItems((prev) => prev.map((item) => (item.id === payload.new.id ? payload.new : item))),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [initialSubmission.id])

  return { submission, items }
}
