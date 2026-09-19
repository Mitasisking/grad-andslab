'use client'

import { useState } from 'react'
import { QrScanner } from '@/components/admin/qr-scanner'
import { IntakeOrderPanel } from '@/components/admin/intake-order-panel'
import type { SubmissionItemRow, SubmissionRow, SubmissionStatusLogRow } from '@/lib/submission-types'

interface Order {
  submission: SubmissionRow
  items: SubmissionItemRow[]
  statusHistory: SubmissionStatusLogRow[]
}

export function IntakePortal() {
  const [token, setToken] = useState<string | null>(null)
  const [order, setOrder] = useState<Order | null>(null)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [manualToken, setManualToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [handoverPin, setHandoverPin] = useState('')
  const [handoverError, setHandoverError] = useState<string | null>(null)
  const [handoverLoading, setHandoverLoading] = useState(false)

  async function lookupToken(nextToken: string) {
    setLoading(true)
    setLookupError(null)
    const res = await fetch(`/api/admin/intake/lookup?token=${encodeURIComponent(nextToken)}`)
    const data = await res.json()
    setLoading(false)
    if (!res.ok) {
      setLookupError(data.error ?? 'No submission found for that code.')
      return
    }
    setToken(nextToken)
    setOrder({ submission: data.submission, items: data.items, statusHistory: data.statusHistory ?? [] })
  }

  async function verifyHandoverPin() {
    setHandoverLoading(true)
    setHandoverError(null)
    const res = await fetch('/api/admin/intake/booth-handover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: handoverPin }),
    })
    const data = await res.json()
    setHandoverLoading(false)
    if (!res.ok) {
      setHandoverError(data.error ?? 'Could not verify that PIN.')
      return
    }
    setHandoverPin('')
    // Reuses the same lookup path a QR scan would take, so the found
    // submission renders through the same IntakeOrderPanel below.
    await lookupToken(data.qrCodeToken)
  }

  if (order && token) {
    return (
      <IntakeOrderPanel
        submission={order.submission}
        items={order.items}
        statusHistory={order.statusHistory}
        onRefresh={() => lookupToken(token)}
        onDone={() => {
          setOrder(null)
          setToken(null)
        }}
      />
    )
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <p className="text-[13px]" style={{ color: 'var(--ink-muted)' }}>
        Admin intake
      </p>
      <h1 className="text-[28px] mt-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
        Scan a manifest
      </h1>
      <p className="text-[14px] mt-2" style={{ color: 'var(--ink-muted)' }}>
        Point the camera at the QR code on the package, or enter the code manually.
      </p>

      <div className="mt-6">
        <QrScanner onDetected={lookupToken} />
      </div>

      <div className="mt-6 flex gap-2">
        <input
          value={manualToken}
          onChange={(e) => setManualToken(e.target.value)}
          placeholder="Or paste manifest token"
          className="flex-1 border rounded-[3px] px-3 py-2 text-[14px] bg-transparent"
          style={{ borderColor: 'var(--line)', color: 'var(--ink)' }}
        />
        <button
          type="button"
          onClick={() => manualToken && lookupToken(manualToken)}
          disabled={!manualToken || loading}
          className="px-4 py-2 text-[13.5px] rounded-[3px] shrink-0"
          style={{ background: 'var(--vault)', color: 'var(--vault-ink)' }}
        >
          {loading ? 'Looking up…' : 'Open'}
        </button>
      </div>

      {lookupError && (
        <p className="text-[13px] mt-3" style={{ color: 'var(--danger)' }}>
          {lookupError}
        </p>
      )}

      <div className="mt-10 pt-8 border-t" style={{ borderColor: 'var(--line)' }}>
        <h2 className="text-[18px]" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
          Booth handover
        </h2>
        <p className="text-[13.5px] mt-1" style={{ color: 'var(--ink-muted)' }}>
          For in-person event drop-off: enter the customer&rsquo;s 4-digit PIN from their
          confirmation screen.
        </p>
        <div className="mt-4 flex gap-2">
          <input
            value={handoverPin}
            onChange={(e) => setHandoverPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="4-digit PIN"
            inputMode="numeric"
            maxLength={4}
            className="flex-1 border rounded-[3px] px-3 py-2 text-[14px] bg-transparent tracking-[0.2em]"
            style={{ borderColor: 'var(--line)', color: 'var(--ink)' }}
          />
          <button
            type="button"
            onClick={verifyHandoverPin}
            disabled={handoverPin.length !== 4 || handoverLoading}
            className="px-4 py-2 text-[13.5px] rounded-[3px] shrink-0"
            style={{ background: 'var(--vault)', color: 'var(--vault-ink)' }}
          >
            {handoverLoading ? 'Verifying…' : 'Confirm handover'}
          </button>
        </div>
        {handoverError && (
          <p className="text-[13px] mt-3" style={{ color: 'var(--danger)' }}>
            {handoverError}
          </p>
        )}
      </div>
    </main>
  )
}
