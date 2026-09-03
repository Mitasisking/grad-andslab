'use client'

import { useState, type DragEvent } from 'react'
import { uploadIntakePhoto } from '@/lib/admin/photo-upload-client'
import { STATUS_STAGES } from '@/lib/submission-types'
import type { SubmissionItemRow, SubmissionRow, SubmissionStatus, SubmissionStatusLogRow } from '@/lib/submission-types'

interface Props {
  submission: SubmissionRow
  items: SubmissionItemRow[]
  statusHistory: SubmissionStatusLogRow[]
  onRefresh: () => void
  onDone: () => void
}

export function IntakeOrderPanel({ submission, items, statusHistory, onRefresh, onDone }: Props) {
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null)
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const [showOverride, setShowOverride] = useState(false)
  const [overrideStatus, setOverrideStatus] = useState<SubmissionStatus | null>(null)
  const [overrideReason, setOverrideReason] = useState('')
  const [applyingOverride, setApplyingOverride] = useState(false)
  const [overrideError, setOverrideError] = useState<string | null>(null)

  const currentIndex = STATUS_STAGES.findIndex((s) => s.value === submission.status)
  const nextStatus = STATUS_STAGES[currentIndex + 1]?.value

  async function advanceStatus() {
    if (!nextStatus) return
    setUpdatingStatus(true)
    const res = await fetch('/api/admin/intake/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submissionId: submission.id, status: nextStatus }),
    })
    setUpdatingStatus(false)
    if (res.ok) onRefresh()
  }

  async function applyOverride() {
    if (!overrideStatus || !overrideReason.trim()) return
    setApplyingOverride(true)
    setOverrideError(null)
    const res = await fetch('/api/admin/intake/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submissionId: submission.id,
        status: overrideStatus,
        reason: overrideReason.trim(),
      }),
    })
    const data = await res.json()
    setApplyingOverride(false)
    if (!res.ok) {
      setOverrideError(data.error ?? 'Could not apply override')
      return
    }
    setShowOverride(false)
    setOverrideStatus(null)
    setOverrideReason('')
    onRefresh()
  }

  async function handleUpload(itemId: string, file: File) {
    setUploadingItemId(itemId)
    setUploadError(null)
    try {
      await uploadIntakePhoto(itemId, file)
      onRefresh()
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploadingItemId(null)
    }
  }

  async function handleDrop(itemId: string, e: DragEvent) {
    e.preventDefault()
    setDragOverItemId(null)
    const file = e.dataTransfer.files[0]
    if (file) await handleUpload(itemId, file)
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
          Scan another
        </button>
      </div>

      <div
        className="mt-6 flex items-center justify-between border rounded-[3px] p-4 gap-4"
        style={{ borderColor: 'var(--line)' }}
      >
        <div>
          <p className="text-[13px]" style={{ color: 'var(--ink-muted)' }}>
            Current status
          </p>
          <p className="text-[16px] mt-0.5 capitalize" style={{ color: 'var(--ink)' }}>
            {submission.status}
          </p>
        </div>
        {nextStatus ? (
          <button
            type="button"
            onClick={advanceStatus}
            disabled={updatingStatus}
            className="px-4 py-2 text-[13.5px] rounded-[3px] shrink-0"
            style={{ background: 'var(--vault)', color: 'var(--vault-ink)' }}
          >
            {updatingStatus ? 'Updating…' : `Mark ${nextStatus}`}
          </button>
        ) : (
          <span className="text-[13px] shrink-0" style={{ color: 'var(--seal)' }}>
            Pipeline complete
          </span>
        )}
      </div>

      {!showOverride ? (
        <button
          type="button"
          onClick={() => setShowOverride(true)}
          className="mt-3 text-[13px] underline underline-offset-2"
          style={{ color: 'var(--ink-muted)' }}
        >
          Override status
        </button>
      ) : (
        <div className="mt-3 border rounded-[3px] p-4" style={{ borderColor: 'var(--line)' }}>
          <p className="text-[13px]" style={{ color: 'var(--ink-muted)' }}>
            Move to any stage directly — for correcting a mis-scan or reopening a stage. Every override is
            recorded with your reason.
          </p>

          <div className="flex flex-wrap gap-2 mt-3">
            {STATUS_STAGES.map((stage) => (
              <button
                key={stage.value}
                type="button"
                onClick={() => setOverrideStatus(stage.value)}
                className="px-3 py-1.5 text-[13px] rounded-[3px] border capitalize"
                style={{
                  borderColor: overrideStatus === stage.value ? 'var(--seal)' : 'var(--line)',
                  background: overrideStatus === stage.value ? 'var(--paper-raised)' : 'transparent',
                  color: 'var(--ink)',
                }}
              >
                {stage.value}
              </button>
            ))}
          </div>

          <textarea
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
            placeholder="Reason for this change (required)"
            rows={2}
            className="w-full border rounded-[3px] px-3 py-2 text-[13.5px] bg-transparent mt-3"
            style={{ borderColor: 'var(--line)', color: 'var(--ink)' }}
          />

          {overrideError && (
            <p className="text-[13px] mt-2" style={{ color: 'var(--danger)' }}>
              {overrideError}
            </p>
          )}

          <div className="flex justify-end gap-2 mt-3">
            <button
              type="button"
              onClick={() => {
                setShowOverride(false)
                setOverrideStatus(null)
                setOverrideReason('')
                setOverrideError(null)
              }}
              className="text-[13px] underline underline-offset-2"
              style={{ color: 'var(--ink-muted)' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={applyOverride}
              disabled={!overrideStatus || !overrideReason.trim() || applyingOverride}
              className="px-4 py-2 text-[13.5px] rounded-[3px]"
              style={{ background: 'var(--seal)', color: 'var(--seal-ink)' }}
            >
              {applyingOverride ? 'Applying…' : 'Apply override'}
            </button>
          </div>
        </div>
      )}

      <div className="mt-8 space-y-3">
        {items.map((item, i) => (
          <div
            key={item.id}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOverItemId(item.id)
            }}
            onDragLeave={() => setDragOverItemId(null)}
            onDrop={(e) => handleDrop(item.id, e)}
            className="border rounded-[3px] p-4"
            style={{
              borderColor: dragOverItemId === item.id ? 'var(--seal)' : 'var(--line)',
              background: dragOverItemId === item.id ? 'var(--paper-raised)' : 'transparent',
            }}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[12px]" style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink-muted)' }}>
                  {String(i + 1).padStart(2, '0')}
                </p>
                <p className="text-[15px] mt-0.5" style={{ color: 'var(--ink)' }}>
                  {item.card_name} <span style={{ color: 'var(--ink-muted)' }}>— {item.set_name}</span>
                </p>
              </div>

              {item.hi_res_photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.hi_res_photo_url}
                  alt={item.card_name}
                  className="w-14 h-14 object-cover rounded-[3px] border shrink-0"
                  style={{ borderColor: 'var(--line)' }}
                />
              ) : (
                <label
                  className="text-[12.5px] underline underline-offset-2 cursor-pointer shrink-0"
                  style={{ color: 'var(--ink)' }}
                >
                  {uploadingItemId === item.id ? 'Uploading…' : 'Upload photo'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleUpload(item.id, file)
                    }}
                  />
                </label>
              )}
            </div>
          </div>
        ))}
      </div>

      {uploadError && (
        <p className="text-[13px] mt-3" style={{ color: 'var(--danger)' }}>
          {uploadError}
        </p>
      )}

      <p className="text-[12.5px] mt-6 leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
        Drag a photo onto a card, or tap &ldquo;Upload photo&rdquo;. Advancing status notifies the customer
        automatically.
      </p>

      {statusHistory.length > 0 && (
        <div className="mt-12">
          <h2 className="text-[16px]" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
            History
          </h2>
          <div className="flex flex-col mt-3 border-t" style={{ borderColor: 'var(--line)' }}>
            {statusHistory.map((log) => (
              <div key={log.id} className="py-3 border-b" style={{ borderColor: 'var(--line)' }}>
                <p className="text-[13.5px] capitalize" style={{ color: 'var(--ink)' }}>
                  {log.from_status ? `${log.from_status} → ${log.to_status}` : `Created as ${log.to_status}`}
                </p>
                <p className="text-[12px] mt-0.5" style={{ color: 'var(--ink-muted)' }}>
                  {log.profiles?.full_name ?? 'Admin'} · {new Date(log.created_at).toLocaleString()}
                  {log.reason ? ` · ${log.reason}` : ''}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}
