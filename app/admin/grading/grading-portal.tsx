'use client'

import { useEffect, useState } from 'react'
import { GradeEntryPanel } from '@/components/admin/grade-entry-panel'
import type { SubmissionItemRow, SubmissionRow } from '@/lib/submission-types'

interface QueueRow {
  id: string
  grading_company: string
  qr_code_token: string
  status: string
  created_at: string
}

export function GradingPortal() {
  const [queue, setQueue] = useState<QueueRow[]>([])
  const [loadingQueue, setLoadingQueue] = useState(true)
  const [manualToken, setManualToken] = useState('')
  const [order, setOrder] = useState<{ submission: SubmissionRow; items: SubmissionItemRow[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/admin/grading/queue')
      .then((res) => res.json())
      .then((data) => setQueue(data.submissions ?? []))
      .finally(() => setLoadingQueue(false))
  }, [])

  async function openByToken(token: string) {
    setLoading(true)
    setError(null)
    const res = await fetch(`/api/admin/intake/lookup?token=${encodeURIComponent(token)}`)
    const data = await res.json()
    setLoading(false)
    if (!res.ok) {
      setError(data.error ?? 'No submission found for that code.')
      return
    }
    setOrder({ submission: data.submission, items: data.items })
  }

  if (order) {
    return (
      <GradeEntryPanel
        submission={order.submission}
        items={order.items}
        onSaved={(submission, items) => setOrder({ submission, items })}
        onDone={() => setOrder(null)}
      />
    )
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <p className="text-[13px]" style={{ color: 'var(--ink-muted)' }}>
        Admin grading
      </p>
      <h1 className="text-[28px] mt-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
        Enter grade results
      </h1>
      <p className="text-[14px] mt-2" style={{ color: 'var(--ink-muted)' }}>
        Pick a submission awaiting results, or paste its manifest token.
      </p>

      <div className="mt-6 flex gap-2">
        <input
          value={manualToken}
          onChange={(e) => setManualToken(e.target.value)}
          placeholder="Manifest token"
          className="flex-1 border rounded-[3px] px-3 py-2 text-[14px] bg-transparent"
          style={{ borderColor: 'var(--line)', color: 'var(--ink)' }}
        />
        <button
          type="button"
          onClick={() => manualToken && openByToken(manualToken)}
          disabled={!manualToken || loading}
          className="px-4 py-2 text-[13.5px] rounded-[3px] shrink-0"
          style={{ background: 'var(--vault)', color: 'var(--vault-ink)' }}
        >
          {loading ? 'Opening…' : 'Open'}
        </button>
      </div>

      {error && (
        <p className="text-[13px] mt-3" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}

      <div className="mt-10">
        <h2 className="text-[16px]" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
          Awaiting results
        </h2>
        <div className="flex flex-col mt-3 border-t" style={{ borderColor: 'var(--line)' }}>
          {!loadingQueue && queue.length === 0 && (
            <p className="py-4 text-[13.5px]" style={{ color: 'var(--ink-muted)' }}>
              Nothing in the queue.
            </p>
          )}
          {queue.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => openByToken(s.qr_code_token)}
              className="flex items-center justify-between py-3 border-b text-left"
              style={{ borderColor: 'var(--line)' }}
            >
              <span className="text-[14px]" style={{ color: 'var(--ink)' }}>
                {s.grading_company} — #{s.qr_code_token.slice(0, 8).toUpperCase()}
              </span>
              <span className="text-[13px] capitalize" style={{ color: 'var(--ink-muted)' }}>
                {s.status}
              </span>
            </button>
          ))}
        </div>
      </div>
    </main>
  )
}
