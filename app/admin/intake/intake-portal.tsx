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
    </main>
  )
}
