'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Printer } from 'lucide-react'
import type { ShippingAddress } from '@/lib/submission-types'

export interface ReturnableBatch {
  id: string
  grader: string
  trackingNumber: string | null
  createdAt: string
  unsortedCount: number
}

export interface ReturnItem {
  id: string
  cardName: string
  setName: string
  gradeCertNumber: string | null
  gradeResult: number | null
  userId: string | null
  clientName: string
  shippingAddress: ShippingAddress | null
}

interface ClientGroup {
  userId: string
  clientName: string
  shippingAddress: ShippingAddress | null
  items: ReturnItem[]
}

interface PackedSlip {
  key: string
  clientName: string
  shippingAddress: ShippingAddress | null
  items: ReturnItem[]
}

function groupByClient(items: ReturnItem[]): ClientGroup[] {
  const groups = new Map<string, ClientGroup>()
  for (const item of items) {
    const key = item.userId ?? `unknown-${item.id}`
    const existing = groups.get(key)
    if (existing) {
      existing.items.push(item)
    } else {
      groups.set(key, {
        userId: key,
        clientName: item.clientName,
        shippingAddress: item.shippingAddress,
        items: [item],
      })
    }
  }
  return Array.from(groups.values())
}

function AddressBlock({ address }: { address: ShippingAddress | null }) {
  if (!address) {
    return (
      <p className="text-[13px]" style={{ color: 'var(--ink-muted)' }}>
        No shipping address on file
      </p>
    )
  }
  return (
    <p className="text-[13px]" style={{ color: 'var(--ink)' }}>
      {address.name}
      <br />
      {address.line1}
      {address.line2 ? <>, {address.line2}</> : null}
      <br />
      {address.city}, {address.state} {address.postal}
      <br />
      {address.country}
    </p>
  )
}

function CardChecklistRow({ item }: { item: ReturnItem }) {
  return (
    <span>
      {item.cardName} <span style={{ color: 'var(--ink-muted)' }}>· {item.setName}</span>
      {item.gradeCertNumber && (
        <span className="ml-1.5" style={{ color: 'var(--ink-muted)' }}>
          Cert #{item.gradeCertNumber}
        </span>
      )}
      {item.gradeResult != null && (
        <span className="ml-1.5" style={{ color: 'var(--seal)' }}>
          Grade {item.gradeResult}
        </span>
      )}
    </span>
  )
}

/**
 * Rendered once a client's box has been marked packed (see this file's
 * PackedSlip type) -- both as an on-screen preview under "Ready to print"
 * and, alone, as the entire page while ReturnSplitter's printTarget branch
 * is active.
 */
function PrintableSlip({ slip }: { slip: PackedSlip }) {
  return (
    <div className="border rounded-[3px] p-5" style={{ borderColor: 'var(--line)' }}>
      <p className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--ink-muted)' }}>
        Return packing slip
      </p>
      <h3 className="text-[16px] mt-1" style={{ color: 'var(--ink)' }}>
        {slip.clientName}
      </h3>
      <div className="mt-2">
        <AddressBlock address={slip.shippingAddress} />
      </div>
      <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--line)' }}>
        <p className="text-[12px]" style={{ color: 'var(--ink-muted)' }}>
          Contents ({slip.items.length})
        </p>
        <ul className="mt-1.5 flex flex-col gap-1 text-[13.5px]" style={{ color: 'var(--ink)' }}>
          {slip.items.map((item) => (
            <li key={item.id}>
              <CardChecklistRow item={item} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function ClientBox({
  group,
  checkedIds,
  onToggle,
  onMarkPacked,
  isPacking,
}: {
  group: ClientGroup
  checkedIds: Set<string>
  onToggle: (itemId: string) => void
  onMarkPacked: () => void
  isPacking: boolean
}) {
  const allChecked = group.items.every((item) => checkedIds.has(item.id))

  return (
    <div className="border rounded-[3px] p-5" style={{ borderColor: 'var(--line)' }}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-[16px]" style={{ color: 'var(--ink)' }}>
            {group.clientName}
          </h3>
          <p className="text-[12.5px] mt-0.5" style={{ color: 'var(--ink-muted)' }}>
            {checkedIds.size} of {group.items.length} checked
          </p>
        </div>
        <button
          type="button"
          onClick={onMarkPacked}
          disabled={!allChecked || isPacking}
          className="inline-flex items-center gap-2 px-4 py-2 text-[13.5px] rounded-[3px] disabled:opacity-50 shrink-0"
          style={{ background: 'var(--vault)', color: 'var(--vault-ink)' }}
        >
          {isPacking && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Mark as Packed
        </button>
      </div>

      <div className="mt-3">
        <AddressBlock address={group.shippingAddress} />
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {group.items.map((item) => (
          <label key={item.id} className="flex items-start gap-2.5 text-[13.5px]">
            <input
              type="checkbox"
              checked={checkedIds.has(item.id)}
              onChange={() => onToggle(item.id)}
              className="mt-0.5"
            />
            <CardChecklistRow item={item} />
          </label>
        ))}
      </div>
    </div>
  )
}

export function ReturnSplitter({
  batches,
  selectedBatchId,
  items,
}: {
  batches: ReturnableBatch[]
  selectedBatchId: string | null
  items: ReturnItem[]
}) {
  const router = useRouter()
  const groups = groupByClient(items)

  const [checkedByClient, setCheckedByClient] = useState<Record<string, Set<string>>>({})
  const [packingClientId, setPackingClientId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [packedSlips, setPackedSlips] = useState<PackedSlip[]>([])
  const [printTarget, setPrintTarget] = useState<string | null>(null)

  function toggle(clientUserId: string, itemId: string) {
    setCheckedByClient((prev) => {
      const next = new Set(prev[clientUserId] ?? [])
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return { ...prev, [clientUserId]: next }
    })
  }

  async function markPacked(group: ClientGroup) {
    setPackingClientId(group.userId)
    setError(null)
    try {
      const res = await fetch('/api/admin/logistics/mark-packed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds: group.items.map((i) => i.id) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Could not mark this client as packed.')
        return
      }
      setPackedSlips((prev) => [
        {
          key: `${group.userId}-${Date.now()}`,
          clientName: group.clientName,
          shippingAddress: group.shippingAddress,
          items: group.items,
        },
        ...prev,
      ])
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error — could not reach the server.')
    } finally {
      setPackingClientId(null)
    }
  }

  function printSlip(key: string) {
    setPrintTarget(key)
    // Let the print-only render below commit before the (synchronous,
    // blocking-until-dismissed) print dialog opens, then return to the
    // normal dashboard once it closes.
    requestAnimationFrame(() => {
      window.print()
      setPrintTarget(null)
    })
  }

  // While a specific slip is queued to print, swap the entire page for just
  // that slip -- simpler and less error-prone than hiding every other
  // section piecemeal with a print:hidden class, and guarantees nothing
  // else on the dashboard (batch picker, other clients' checklists, other
  // slips) can leak onto the printed page.
  if (printTarget) {
    const slip = packedSlips.find((s) => s.key === printTarget)
    return <main className="mx-auto max-w-2xl px-6 py-12">{slip && <PrintableSlip slip={slip} />}</main>
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <p className="text-[13px]" style={{ color: 'var(--ink-muted)' }}>
        Admin
      </p>
      <h1 className="text-[28px] mt-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
        Return Splitter
      </h1>
      <p className="text-[13.5px] mt-2 max-w-2xl" style={{ color: 'var(--ink-muted)' }}>
        Pick a batch that has cards back from the grader, check off each client&apos;s cards as you physically pack
        their box, then mark them packed — that moves those cards to Shipped to Client and gives you a printable
        slip for the box.
      </p>

      <div className="mt-8">
        <h2 className="text-[13px] uppercase tracking-wide" style={{ color: 'var(--ink-muted)' }}>
          Batches awaiting sorting
        </h2>
        {batches.length === 0 ? (
          <p className="text-[13.5px] mt-3" style={{ color: 'var(--ink-muted)' }}>
            No batches currently have cards sitting in Returned to HQ — nothing to sort right now.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2 mt-3">
            {batches.map((batch) => (
              <Link
                key={batch.id}
                href={`/admin/logistics?batch=${batch.id}`}
                className="px-3.5 py-2 text-[13px] rounded-[3px] border"
                style={{
                  borderColor: batch.id === selectedBatchId ? 'var(--seal)' : 'var(--line)',
                  color: batch.id === selectedBatchId ? 'var(--seal)' : 'var(--ink)',
                }}
              >
                {batch.grader} {batch.trackingNumber ? `· ${batch.trackingNumber}` : ''} — {batch.unsortedCount} card
                {batch.unsortedCount === 1 ? '' : 's'}
              </Link>
            ))}
          </div>
        )}
      </div>

      {error && (
        <p className="text-[13px] mt-4" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}

      {selectedBatchId && (
        <div className="mt-8">
          <h2 className="text-[16px] uppercase tracking-wide" style={{ color: 'var(--seal)' }}>
            Sort by client
          </h2>
          {groups.length === 0 ? (
            <p className="text-[13.5px] mt-3" style={{ color: 'var(--ink-muted)' }}>
              Every card in this batch has already been sorted and packed.
            </p>
          ) : (
            <div className="flex flex-col gap-4 mt-4">
              {groups.map((group) => (
                <ClientBox
                  key={group.userId}
                  group={group}
                  checkedIds={checkedByClient[group.userId] ?? new Set()}
                  onToggle={(itemId) => toggle(group.userId, itemId)}
                  onMarkPacked={() => markPacked(group)}
                  isPacking={packingClientId === group.userId}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {packedSlips.length > 0 && (
        <div className="mt-10">
          <h2 className="text-[16px] uppercase tracking-wide" style={{ color: 'var(--seal)' }}>
            Ready to print
          </h2>
          <div className="flex flex-col gap-4 mt-4">
            {packedSlips.map((slip) => (
              <div key={slip.key}>
                <button
                  type="button"
                  onClick={() => printSlip(slip.key)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-[13.5px] rounded-[3px] border mb-2"
                  style={{ borderColor: 'var(--line)', color: 'var(--ink)' }}
                >
                  <Printer className="size-4" aria-hidden="true" />
                  Print packing slip — {slip.clientName}
                </button>
                <PrintableSlip slip={slip} />
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}
