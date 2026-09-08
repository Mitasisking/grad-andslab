'use client'

import { useState } from 'react'
import type { PoolRow, PoolStatus } from '@/lib/submission-types'
import type { PoolSubmissionRow } from './page'

const STATUS_LABEL: Record<PoolStatus, string> = {
  open: 'Filling',
  closed: 'Closed — awaiting pickup',
  shipped: 'Shipped to grader',
  completed: 'Completed',
}

const NEXT_STATUS: Record<PoolStatus, PoolStatus | null> = {
  open: 'closed',
  closed: 'shipped',
  shipped: 'completed',
  completed: null,
}

const NEXT_ACTION_LABEL: Record<PoolStatus, string> = {
  open: 'Close batch',
  closed: 'Mark shipped',
  shipped: 'Mark completed',
  completed: '',
}

interface Props {
  pools: PoolRow[]
  submissionsByPool: Record<string, PoolSubmissionRow[]>
}

export function AdminPoolsBoard({ pools, submissionsByPool }: Props) {
  const [poolState, setPoolState] = useState(pools)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function advance(pool: PoolRow) {
    const nextStatus = NEXT_STATUS[pool.status]
    if (!nextStatus) return
    setPending(pool.id)
    setError(null)

    const res = await fetch('/api/admin/pools/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ poolId: pool.id, status: nextStatus }),
    })
    const data = await res.json()
    setPending(null)

    if (!res.ok) {
      setError(data.error ?? 'Could not update this batch.')
      return
    }

    setPoolState((prev) => prev.map((p) => (p.id === pool.id ? (data.pool as PoolRow) : p)))
  }

  if (poolState.length === 0) {
    return (
      <p className="text-[13.5px] mt-8" style={{ color: 'var(--ink-muted)' }}>
        No batches yet — one opens automatically the moment a submission is created.
      </p>
    )
  }

  return (
    <div className="mt-8 space-y-4">
      {error && (
        <p className="text-[13px]" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}

      {poolState.map((pool) => {
        const pct = Math.min(100, Math.round((pool.current_count / pool.capacity) * 100))
        const members = submissionsByPool[pool.id] ?? []
        const isExpanded = expanded.has(pool.id)
        const nextStatus = NEXT_STATUS[pool.status]

        return (
          <div key={pool.id} className="border rounded-[3px] p-5" style={{ borderColor: 'var(--line)' }}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-[16px]" style={{ color: 'var(--ink)' }}>
                  {pool.label}
                </p>
                <p className="text-[12.5px] mt-1" style={{ color: 'var(--ink-muted)' }}>
                  {STATUS_LABEL[pool.status]} · opened {new Date(pool.opened_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <p
                  className="text-[15px]"
                  style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}
                >
                  {pool.current_count}/{pool.capacity}
                </p>
                {nextStatus && (
                  <button
                    type="button"
                    onClick={() => advance(pool)}
                    disabled={pending === pool.id}
                    className="text-[12.5px] px-3 py-1.5 rounded-[3px] border"
                    style={{ borderColor: 'var(--line)', color: 'var(--ink)' }}
                  >
                    {pending === pool.id ? 'Updating…' : NEXT_ACTION_LABEL[pool.status]}
                  </button>
                )}
              </div>
            </div>

            <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--line)' }}>
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--seal)' }} />
            </div>

            <button
              type="button"
              onClick={() => toggleExpanded(pool.id)}
              className="text-[12.5px] mt-3 underline underline-offset-2"
              style={{ color: 'var(--ink-muted)' }}
            >
              {isExpanded ? 'Hide' : 'Show'} {members.length} submission{members.length === 1 ? '' : 's'}
            </button>

            {isExpanded && (
              <div className="mt-3 border-t" style={{ borderColor: 'var(--line)' }}>
                {members.length === 0 ? (
                  <p className="text-[13px] py-3" style={{ color: 'var(--ink-muted)' }}>
                    No submissions recorded in this batch.
                  </p>
                ) : (
                  members.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-4 py-2.5 border-b text-[13.5px]"
                      style={{ borderColor: 'var(--line)' }}
                    >
                      <span style={{ color: 'var(--ink)' }}>
                        {m.profiles?.full_name || m.profiles?.email || 'Unknown client'}
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        {m.needs_clean_and_polish && (
                          <span
                            className="text-[11px] px-1.5 py-0.5 rounded-[2px]"
                            style={{ background: 'var(--vault)', color: 'var(--vault-ink)' }}
                          >
                            Clean &amp; Polish
                          </span>
                        )}
                        <span style={{ color: 'var(--ink-muted)' }}>
                          {new Date(m.created_at).toLocaleDateString()}
                        </span>
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
