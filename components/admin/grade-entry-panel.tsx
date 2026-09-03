'use client'

import { useState } from 'react'
import type { SubmissionItemRow, SubmissionRow } from '@/lib/submission-types'

interface Props {
  submission: SubmissionRow
  items: SubmissionItemRow[]
  onSaved: (submission: SubmissionRow, items: SubmissionItemRow[]) => void
  onDone: () => void
}

interface Draft {
  gradeResult: string
  gradeCertNumber: string
}

export function GradeEntryPanel({ submission, items, onSaved, onDone }: Props) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(
      items.map((item) => [
        item.id,
        { gradeResult: item.grade_result?.toString() ?? '', gradeCertNumber: item.grade_cert_number ?? '' },
      ]),
    ),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)

  function updateDraft(itemId: string, patch: Partial<Draft>) {
    setDrafts((prev) => ({ ...prev, [itemId]: { ...prev[itemId], ...patch } }))
  }

  const canSave = items.some((item) => drafts[item.id]?.gradeResult.trim() !== '')

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSavedMessage(null)

    const grades = items
      .filter((item) => drafts[item.id].gradeResult.trim() !== '')
      .map((item) => ({
        itemId: item.id,
        gradeResult: Number(drafts[item.id].gradeResult),
        gradeCertNumber: drafts[item.id].gradeCertNumber.trim(),
      }))

    const res = await fetch('/api/admin/grading/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submissionId: submission.id, grades }),
    })
    const data = await res.json()
    setSaving(false)

    if (!res.ok) {
      setError(data.error ?? 'Could not save results')
      return
    }

    onSaved(data.submission ?? submission, data.items ?? items)
    setSavedMessage(
      data.autoAdvanced
        ? 'Results saved — submission marked graded and the customer was notified.'
        : 'Results saved.',
    )
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[13px]" style={{ color: 'var(--ink-muted)' }}>
            Manifest #{submission.qr_code_token.slice(0, 8).toUpperCase()}
          </p>
          <h1 className="text-[24px] mt-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
            {submission.grading_company} — {items.length} {items.length === 1 ? 'card' : 'cards'}
          </h1>
        </div>
        <button
          type="button"
          onClick={onDone}
          className="text-[13px] underline underline-offset-2 shrink-0"
          style={{ color: 'var(--ink-muted)' }}
        >
          Back to queue
        </button>
      </div>

      <div className="mt-8 space-y-3">
        {items.map((item, i) => (
          <div key={item.id} className="border rounded-[3px] p-4" style={{ borderColor: 'var(--line)' }}>
            <p className="text-[12px]" style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink-muted)' }}>
              {String(i + 1).padStart(2, '0')}
            </p>
            <p className="text-[15px] mt-0.5" style={{ color: 'var(--ink)' }}>
              {item.card_name} <span style={{ color: 'var(--ink-muted)' }}>— {item.set_name}</span>
            </p>

            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className="text-[12.5px] block mb-1" style={{ color: 'var(--ink-muted)' }}>
                  Grade
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  step="0.5"
                  value={drafts[item.id].gradeResult}
                  onChange={(e) => updateDraft(item.id, { gradeResult: e.target.value })}
                  placeholder="9.5"
                  className="w-full border rounded-[3px] px-3 py-2 text-[14px] bg-transparent"
                  style={{ borderColor: 'var(--line)', color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}
                />
              </div>
              <div>
                <label className="text-[12.5px] block mb-1" style={{ color: 'var(--ink-muted)' }}>
                  Cert number
                </label>
                <input
                  type="text"
                  value={drafts[item.id].gradeCertNumber}
                  onChange={(e) => updateDraft(item.id, { gradeCertNumber: e.target.value })}
                  placeholder="82013456"
                  className="w-full border rounded-[3px] px-3 py-2 text-[14px] bg-transparent"
                  style={{ borderColor: 'var(--line)', color: 'var(--ink)' }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <p className="text-[13px] mt-4" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}
      {savedMessage && (
        <p className="text-[13px] mt-4" style={{ color: 'var(--seal)' }}>
          {savedMessage}
        </p>
      )}

      <div className="flex justify-end pt-6">
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave || saving}
          className="px-4 py-2 text-[13.5px] rounded-[3px]"
          style={{ background: 'var(--vault)', color: 'var(--vault-ink)' }}
        >
          {saving ? 'Saving…' : 'Save results'}
        </button>
      </div>
    </main>
  )
}
