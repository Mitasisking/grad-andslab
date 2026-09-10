import Link from 'next/link'
import { TIER_OPTIONS_BY_COMPANY, type PoolRow } from '@/lib/submission-types'

interface Props {
  pools: PoolRow[]
}

function tierLabel(pool: PoolRow): string {
  const tier = TIER_OPTIONS_BY_COMPANY[pool.grading_company]?.find((t) => t.value === pool.tier)
  return tier?.label ?? pool.tier
}

/**
 * Homepage marketing section — a one-shot server-rendered snapshot of
 * currently-filling batches (lib/pools/active-pools.ts), distinct from
 * components/PoolTracker.tsx's realtime client-side widget used inside the
 * submit flow itself. A static per-request snapshot is the right tradeoff
 * here: this is a public landing page, not an active checkout a customer is
 * staring at waiting for a count to tick up, so a websocket subscription
 * would be overhead without a real benefit.
 */
export function LivePools({ pools }: Props) {
  if (pools.length === 0) return null

  return (
    <section className="py-20 md:py-24 bg-slate-950 border-y border-slate-800">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Live Batch Tracker</h2>
          <p className="text-slate-400 max-w-xl mx-auto text-lg">
            Track active submission pools in real time. Batches ship as soon as capacity is reached.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {pools.map((pool) => {
            const pct = Math.min(100, Math.round((pool.current_count / pool.capacity) * 100))
            return (
              <div
                key={pool.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col hover:border-[#a67c00]/50 transition duration-300"
              >
                <span className="inline-block self-start px-2.5 py-1 rounded-full bg-[#a67c00]/10 text-[#a67c00] text-xs font-bold uppercase tracking-wide mb-3">
                  {pool.grading_company}
                </span>
                <h3 className="text-lg font-bold text-slate-100 mb-4">
                  {pool.grading_company} {tierLabel(pool)}
                </h3>

                <div className="h-2.5 rounded-full bg-slate-800 overflow-hidden mb-2">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: '#a67c00' }}
                  />
                </div>
                <div className="flex items-center justify-between text-sm text-slate-400 mb-6">
                  <span>
                    {pool.current_count} / {pool.capacity} cards
                  </span>
                  <span>{pct}% full</span>
                </div>

                <Link
                  href={`/submit?company=${pool.grading_company}&tier=${pool.tier}`}
                  className="mt-auto block text-center w-full bg-[#a67c00] hover:bg-[#997100] text-black font-bold text-sm px-5 py-3 rounded-xl transition"
                >
                  Join Batch
                </Link>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
