'use client'

import { TIER_OPTIONS_BY_COMPANY } from '@/lib/submission-types'
import type { GradingCompany, PoolRow, SubmissionTier } from '@/lib/submission-types'

export type IntakeMode = 'batch' | 'custom'

interface Props {
  pools: PoolRow[]
  mode: IntakeMode
  onModeChange: (mode: IntakeMode) => void
  onJoinBatch: (company: GradingCompany, tier: SubmissionTier) => void
}

// pools.label (0035_submission_pools.sql's assign_submission_pool()) is
// auto-generated as "<company> <raw tier slug> Batch #<n>" -- readable
// enough for PoolTracker's small sidebar rows, but too raw for this panel's
// card headline, so look up the tier's real display label instead. Falls
// back to a humanized version of the raw slug for a pool still open under a
// since-retired tier (e.g. ACE's old "Value" tier), rather than showing the
// slug verbatim.
function tierLabel(pool: PoolRow): string {
  const tier = TIER_OPTIONS_BY_COMPANY[pool.grading_company]?.find((t) => t.value === pool.tier)
  if (tier) return tier.label
  return pool.tier.replace(/^\w+_/, '').replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}

/**
 * Top-of-/submit batch browser -- replaces the standalone /batches route
 * (removed alongside this) now that joining a batch and filling out the
 * submission form happen on the same page. Styled to match /submit's own
 * "vault" theme (CSS custom properties) rather than the slate/amber
 * Tailwind palette components/LivePools.tsx used, since that component's
 * marketing-page styling never has to sit next to the wizard's own chrome.
 */
export function ActiveBatchesPanel({ pools, mode, onModeChange, onJoinBatch }: Props) {
  return (
    <section className="mb-12">
      <div className="flex gap-1 border-b" style={{ borderColor: 'var(--line)' }}>
        <button
          type="button"
          onClick={() => onModeChange('batch')}
          className="px-4 py-2.5 text-[13.5px] -mb-px border-b-2 transition"
          style={{
            borderColor: mode === 'batch' ? 'var(--seal)' : 'transparent',
            color: mode === 'batch' ? 'var(--ink)' : 'var(--ink-muted)',
          }}
        >
          Select from Active Batches
        </button>
        <button
          type="button"
          onClick={() => onModeChange('custom')}
          className="px-4 py-2.5 text-[13.5px] -mb-px border-b-2 transition"
          style={{
            borderColor: mode === 'custom' ? 'var(--seal)' : 'transparent',
            color: mode === 'custom' ? 'var(--ink)' : 'var(--ink-muted)',
          }}
        >
          Custom Submission
        </button>
      </div>

      {mode === 'batch' &&
        (pools.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
            {pools.map((pool) => {
              const pct = Math.min(100, Math.round((pool.current_count / pool.capacity) * 100))
              return (
                <div key={pool.id} className="border rounded-[3px] p-5 flex flex-col" style={{ borderColor: 'var(--line)' }}>
                  <span className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--seal)' }}>
                    {pool.grading_company}
                  </span>
                  <h3 className="text-[16px] mt-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
                    {tierLabel(pool)}
                  </h3>
                  <div className="h-1.5 rounded-full mt-4 overflow-hidden" style={{ background: 'var(--line)' }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: 'var(--seal)' }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[12px] mt-2" style={{ color: 'var(--ink-muted)' }}>
                    <span>
                      {pool.current_count} / {pool.capacity} cards
                    </span>
                    <span>{pct}% full</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onJoinBatch(pool.grading_company, pool.tier)}
                    className="mt-4 py-2.5 text-[13px] rounded-[3px]"
                    style={{ background: 'var(--seal)', color: 'var(--seal-ink)' }}
                  >
                    Join Batch
                  </button>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-[13.5px] mt-6" style={{ color: 'var(--ink-muted)' }}>
            No batches are currently filling. Switch to Custom Submission to choose your grader and tier directly.
          </p>
        ))}
    </section>
  )
}
