'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { PoolRow } from '@/lib/submission-types'

interface Props {
  /** Show one specific batch — e.g. the one a customer's own submission landed in. */
  poolId?: string
  /**
   * Show the current open batch for a company/tier instead of a specific
   * pool id — used for a general "here's what's filling up right now" view
   * (e.g. on the /submit flow before a submission exists). Ignored if
   * poolId is set.
   */
  gradingCompany?: string
  tier?: string
  /** Cap how many batches render when no single pool/company+tier is targeted. */
  limit?: number
}

const STATUS_LABEL: Record<PoolRow['status'], string> = {
  open: 'Filling',
  closed: 'Closed — awaiting pickup',
  shipped: 'Shipped to grader',
  completed: 'Completed',
}

/**
 * Public, read-only view into supabase/migrations/0035_submission_pools.sql's
 * pools table — no auth required (pools RLS grants select to everyone; they
 * carry no customer PII, just company/tier/counts). Renders live via
 * postgres_changes the same way lib/hooks/use-realtime-submission.ts does
 * for a single submission.
 */
export function PoolTracker({ poolId, gradingCompany, tier, limit = 4 }: Props) {
  const [pools, setPools] = useState<PoolRow[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      let query = supabase.from('pools').select('*')

      if (poolId) {
        query = query.eq('id', poolId)
      } else {
        query = query.eq('status', 'open').order('opened_at', { ascending: true }).limit(limit)
        if (gradingCompany) query = query.eq('grading_company', gradingCompany)
        if (tier) query = query.eq('tier', tier)
      }

      const { data } = await query
      if (!cancelled) {
        setPools((data ?? []) as PoolRow[])
        setLoaded(true)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [poolId, gradingCompany, tier, limit])

  useEffect(() => {
    const channel = supabase
      .channel(poolId ? `pool:${poolId}` : 'pools:open')
      .on<PoolRow>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pools', ...(poolId ? { filter: `id=eq.${poolId}` } : {}) },
        (payload) => {
          setPools((prev) => {
            if (payload.eventType === 'DELETE') return prev.filter((p) => p.id !== payload.old.id)
            const next = payload.new as PoolRow
            // Not tracking a single pool: only show pools this view actually cares about.
            if (!poolId && next.status !== 'open') return prev.filter((p) => p.id !== next.id)
            const exists = prev.some((p) => p.id === next.id)
            return exists ? prev.map((p) => (p.id === next.id ? next : p)) : [...prev, next]
          })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [poolId])

  if (!loaded) return null
  if (pools.length === 0) return null

  return (
    <div className="space-y-4">
      <p className="text-[11.5px] uppercase tracking-wide" style={{ color: 'var(--ink-muted)' }}>
        {poolId ? 'Your batch' : 'Batches filling now'}
      </p>
      <div className="space-y-3">
        {pools.map((pool) => {
          const pct = Math.min(100, Math.round((pool.current_count / pool.capacity) * 100))
          return (
            <div key={pool.id} className="border rounded-[3px] p-3.5" style={{ borderColor: 'var(--line)' }}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[13.5px]" style={{ color: 'var(--ink)' }}>
                  {pool.grading_company} {pool.label.replace(`${pool.grading_company} `, '')}
                </p>
                <p
                  className="text-[12.5px] shrink-0"
                  style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink-muted)' }}
                >
                  {pool.current_count}/{pool.capacity}
                </p>
              </div>
              <div
                className="mt-2 h-1.5 rounded-full overflow-hidden"
                style={{ background: 'var(--line)' }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, background: 'var(--seal)' }}
                />
              </div>
              <p className="text-[11.5px] mt-1.5" style={{ color: 'var(--ink-muted)' }}>
                {STATUS_LABEL[pool.status]}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
