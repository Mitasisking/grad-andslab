'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bookmark, BookmarkCheck, Loader2 } from 'lucide-react'
import { formatUSD } from '@/lib/currency'

export interface MarketTrendRow {
  id: string
  card_name: string
  set_name: string
  language: 'english' | 'japanese'
  raw_estimate: number
  graded_estimate: number
  profit_multiplier: number
  actionable_advice: string
  created_at: string
}

export interface WatchlistEntry {
  id: string
  market_trend_id: string
  card_name: string
  set_name: string
  created_at: string
}

/**
 * TCGplayer (English) quotes in USD, the Japanese market in JPY -- this
 * table has no currency column (supabase/migrations/0050_market_trends.sql),
 * so this shows each row in the currency it actually came in, rather than
 * converting. A ZAR-with-GBP-in-brackets display was asked for at one point,
 * but this app's only real exchange-rate source is GBP->ZAR
 * (lib/pricing/exchange-rate.ts) -- there's no USD->ZAR or JPY->ZAR rate
 * anywhere in this codebase, and inventing one would put a fabricated
 * number in front of an admin deciding what to actually go buy. Wire up a
 * real USD/JPY->ZAR rate source first if that display is still wanted.
 */
function formatEstimate(amount: number, language: 'english' | 'japanese'): string {
  return language === 'japanese'
    ? new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(amount)
    : formatUSD(amount)
}

function WatchlistToggle({
  isWatchlisted,
  isPending,
  onToggle,
}: {
  isWatchlisted: boolean
  isPending: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={isPending}
      className="inline-flex items-center gap-1.5 text-[12.5px] px-2.5 py-1 rounded-[3px] border shrink-0 disabled:opacity-50"
      style={{
        borderColor: isWatchlisted ? 'var(--seal)' : 'var(--line)',
        color: isWatchlisted ? 'var(--seal)' : 'var(--ink-muted)',
      }}
    >
      {isPending ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
      ) : isWatchlisted ? (
        <BookmarkCheck className="size-3.5" aria-hidden="true" />
      ) : (
        <Bookmark className="size-3.5" aria-hidden="true" />
      )}
      {isWatchlisted ? 'Watching' : 'Add to watchlist'}
    </button>
  )
}

export function TrendsDashboard({
  initialTrends,
  initialWatchlist,
}: {
  initialTrends: MarketTrendRow[]
  initialWatchlist: WatchlistEntry[]
}) {
  const router = useRouter()
  // Not local state: router.refresh() (called at the end of handleSweep)
  // re-runs the server component that passes this in as a prop, so reading
  // it directly here already picks up newly inserted rows on the next
  // render -- no mirrored state or sync effect required.
  const trends = initialTrends
  const [watchlist, setWatchlist] = useState(initialWatchlist)
  const [isSweeping, setIsSweeping] = useState(false)
  const [sweepMessage, setSweepMessage] = useState<string | null>(null)
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())

  const watchlistedIds = new Set(watchlist.map((w) => w.market_trend_id))

  async function handleSweep() {
    setIsSweeping(true)
    setSweepMessage(null)
    try {
      const res = await fetch('/api/admin/trends/sweep', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSweepMessage(data.error ?? 'Sweep failed.')
      } else if (data.skipped) {
        setSweepMessage(data.reason)
      } else if (typeof data.inserted === 'number') {
        setSweepMessage(
          data.inserted > 0
            ? `Added ${data.inserted} new recommendation${data.inserted === 1 ? '' : 's'}.`
            : (data.reason ?? 'No new recommendations.'),
        )
      }
      router.refresh()
    } catch (err) {
      setSweepMessage(err instanceof Error ? err.message : 'Network error — could not reach the server.')
    } finally {
      setIsSweeping(false)
    }
  }

  async function toggleWatchlist(trend: MarketTrendRow) {
    const isWatchlisted = watchlistedIds.has(trend.id)
    setPendingIds((prev) => new Set(prev).add(trend.id))
    try {
      if (isWatchlisted) {
        await fetch(`/api/admin/trends/watchlist?marketTrendId=${trend.id}`, { method: 'DELETE' })
        setWatchlist((prev) => prev.filter((w) => w.market_trend_id !== trend.id))
      } else {
        await fetch('/api/admin/trends/watchlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ marketTrendId: trend.id, cardName: trend.card_name, setName: trend.set_name }),
        })
        setWatchlist((prev) => [
          {
            id: trend.id,
            market_trend_id: trend.id,
            card_name: trend.card_name,
            set_name: trend.set_name,
            created_at: new Date().toISOString(),
          },
          ...prev,
        ])
      }
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev)
        next.delete(trend.id)
        return next
      })
    }
  }

  const topPicks = trends.slice(0, 3)
  const rest = trends.slice(3)

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[13px]" style={{ color: 'var(--ink-muted)' }}>
            Admin
          </p>
          <h1 className="text-[28px] mt-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
            Market Trends
          </h1>
        </div>
        <button
          type="button"
          onClick={handleSweep}
          disabled={isSweeping}
          className="inline-flex items-center gap-2 px-4 py-2 text-[13.5px] rounded-[3px] disabled:opacity-50 shrink-0"
          style={{ background: 'var(--vault)', color: 'var(--vault-ink)' }}
        >
          {isSweeping && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {isSweeping ? 'Running sweep…' : 'Run Agent Sweep'}
        </button>
      </div>

      <p className="text-[13.5px] mt-2 max-w-2xl" style={{ color: 'var(--ink-muted)' }}>
        AI-generated &quot;buy raw &amp; grade&quot; arbitrage estimates from the same pipeline as
        app/api/cron/market-trends (run twice daily, or on demand above). These are model-computed estimates from
        third-party market data, not verified quotes or a guarantee of margin — treat every number here as a lead to
        double-check, not a purchase order.
      </p>

      {sweepMessage && (
        <p className="text-[13px] mt-3 px-3 py-2 border rounded-[3px]" style={{ borderColor: 'var(--line)', color: 'var(--ink)' }}>
          {sweepMessage}
        </p>
      )}

      {watchlist.length > 0 && (
        <div className="mt-8">
          <h2 className="text-[16px] uppercase tracking-wide" style={{ color: 'var(--seal)' }}>
            Watchlist
          </h2>
          <div className="flex flex-col gap-2 mt-3">
            {watchlist.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-3 px-3 py-2 border rounded-[3px] text-[13.5px]"
                style={{ borderColor: 'var(--line)' }}
              >
                <span style={{ color: 'var(--ink)' }}>
                  {entry.card_name} <span style={{ color: 'var(--ink-muted)' }}>· {entry.set_name}</span>
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    setPendingIds((prev) => new Set(prev).add(entry.market_trend_id))
                    try {
                      await fetch(`/api/admin/trends/watchlist?marketTrendId=${entry.market_trend_id}`, {
                        method: 'DELETE',
                      })
                      setWatchlist((prev) => prev.filter((w) => w.market_trend_id !== entry.market_trend_id))
                    } finally {
                      setPendingIds((prev) => {
                        const next = new Set(prev)
                        next.delete(entry.market_trend_id)
                        return next
                      })
                    }
                  }}
                  disabled={pendingIds.has(entry.market_trend_id)}
                  className="text-[12.5px] underline underline-offset-2 disabled:opacity-50 shrink-0"
                  style={{ color: 'var(--ink-muted)' }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {trends.length === 0 ? (
        <div className="mt-8 py-16 text-center border rounded-[3px]" style={{ borderColor: 'var(--line)' }}>
          <p className="text-[13.5px]" style={{ color: 'var(--ink-muted)' }}>
            No trend data yet. lib/market-trends/english-pricing.ts and japanese-pricing.ts are still unwired
            placeholder stubs (no verified pricing-API docs were available to build the real fetch against) — the
            sweep intentionally skips writing anything here until at least one of them returns real data. Wire up a
            real provider in either file to start populating this dashboard.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-8">
            <h2 className="text-[16px] uppercase tracking-wide" style={{ color: 'var(--seal)' }}>
              Top opportunities
            </h2>
            <div className="grid sm:grid-cols-3 gap-4 mt-4">
              {topPicks.map((trend) => (
                <div
                  key={trend.id}
                  className="border-2 rounded-[3px] p-5 flex flex-col gap-3"
                  style={{ borderColor: 'var(--seal)', background: 'var(--paper-raised)' }}
                >
                  <div>
                    <p className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--ink-muted)' }}>
                      {trend.language === 'japanese' ? 'Japanese' : 'English'} · {trend.set_name}
                    </p>
                    <p className="text-[16px] mt-1" style={{ color: 'var(--ink)' }}>
                      {trend.card_name}
                    </p>
                    <p
                      className="text-[26px] mt-2"
                      style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--seal)' }}
                    >
                      {trend.profit_multiplier.toFixed(2)}×
                    </p>
                    <p className="text-[12.5px] mt-1" style={{ color: 'var(--ink-muted)' }}>
                      Raw {formatEstimate(trend.raw_estimate, trend.language)} → Graded{' '}
                      {formatEstimate(trend.graded_estimate, trend.language)}
                    </p>
                    <p className="text-[12.5px] mt-3" style={{ color: 'var(--ink)' }}>
                      {trend.actionable_advice}
                    </p>
                  </div>
                  <WatchlistToggle
                    isWatchlisted={watchlistedIds.has(trend.id)}
                    isPending={pendingIds.has(trend.id)}
                    onToggle={() => toggleWatchlist(trend)}
                  />
                </div>
              ))}
            </div>
          </div>

          {rest.length > 0 && (
            <div className="mt-10">
              <h2 className="text-[16px]" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
                All estimates
              </h2>
              <div className="mt-4 border-t" style={{ borderColor: 'var(--line)' }}>
                <div
                  className="hidden sm:grid gap-4 py-2 text-[11.5px] uppercase tracking-wide border-b"
                  style={{
                    gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto',
                    borderColor: 'var(--line)',
                    color: 'var(--ink-muted)',
                  }}
                >
                  <span>Card</span>
                  <span>Language</span>
                  <span>Raw</span>
                  <span>Graded</span>
                  <span>Multiplier</span>
                  <span />
                </div>
                {rest.map((trend) => (
                  <div
                    key={trend.id}
                    className="grid sm:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-2 sm:gap-4 py-3 border-b text-[13.5px] items-center"
                    style={{ borderColor: 'var(--line)' }}
                  >
                    <div>
                      <p style={{ color: 'var(--ink)' }}>{trend.card_name}</p>
                      <p className="text-[12px]" style={{ color: 'var(--ink-muted)' }}>
                        {trend.set_name}
                      </p>
                    </div>
                    <span style={{ color: 'var(--ink-muted)' }}>
                      {trend.language === 'japanese' ? 'Japanese' : 'English'}
                    </span>
                    <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>
                      {formatEstimate(trend.raw_estimate, trend.language)}
                    </span>
                    <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>
                      {formatEstimate(trend.graded_estimate, trend.language)}
                    </span>
                    <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>
                      {trend.profit_multiplier.toFixed(2)}×
                    </span>
                    <WatchlistToggle
                      isWatchlisted={watchlistedIds.has(trend.id)}
                      isPending={pendingIds.has(trend.id)}
                      onToggle={() => toggleWatchlist(trend)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </main>
  )
}
