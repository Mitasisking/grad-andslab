import { redirect } from 'next/navigation'
import { getSupabaseRouteClient } from '@/lib/supabase-route-client'

interface MarketTrendRow {
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

/** TCGplayer (English) quotes in USD, the Japanese market in JPY -- neither this table nor the request that shaped it (supabase/migrations/0050_market_trends.sql) tracks a currency column, so this infers the display symbol from language rather than converting anything. */
function formatEstimate(amount: number, language: 'english' | 'japanese'): string {
  return language === 'japanese'
    ? new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(amount)
    : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

export default async function AdminTrendsPage() {
  const supabase = await getSupabaseRouteClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')

  const { data } = await supabase
    .from('market_trends')
    .select('*')
    .order('profit_multiplier', { ascending: false })
    .limit(50)

  const trends = (data ?? []) as MarketTrendRow[]
  const topPicks = trends.slice(0, 3)
  const rest = trends.slice(3)

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <p className="text-[13px]" style={{ color: 'var(--ink-muted)' }}>
        Admin
      </p>
      <h1 className="text-[28px] mt-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
        Market Trends
      </h1>
      <p className="text-[13.5px] mt-2 max-w-2xl" style={{ color: 'var(--ink-muted)' }}>
        AI-generated &quot;buy raw &amp; grade&quot; arbitrage estimates from app/api/cron/market-trends, run twice
        daily. These are model-computed estimates from third-party market data, not verified quotes or a guarantee of
        margin — treat every number here as a lead to double-check, not a purchase order.
      </p>

      {trends.length === 0 ? (
        <div className="mt-8 py-16 text-center border rounded-[3px]" style={{ borderColor: 'var(--line)' }}>
          <p className="text-[13.5px]" style={{ color: 'var(--ink-muted)' }}>
            No trend data yet. lib/market-trends/english-pricing.ts and japanese-pricing.ts are still unwired
            placeholder stubs (no verified pricing-API docs were available to build the real fetch against) — the
            cron intentionally skips writing anything here until at least one of them returns real data. Wire up a
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
                  className="border-2 rounded-[3px] p-5"
                  style={{ borderColor: 'var(--seal)', background: 'var(--paper-raised)' }}
                >
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
                    gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
                    borderColor: 'var(--line)',
                    color: 'var(--ink-muted)',
                  }}
                >
                  <span>Card</span>
                  <span>Language</span>
                  <span>Raw</span>
                  <span>Graded</span>
                  <span>Multiplier</span>
                </div>
                {rest.map((trend) => (
                  <div
                    key={trend.id}
                    className="grid sm:grid-cols-5 gap-2 sm:gap-4 py-3 border-b text-[13.5px]"
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
