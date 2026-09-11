import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase-server'
import { fetchEnglishMarketData } from '@/lib/market-trends/english-pricing'
import { fetchJapaneseMarketData } from '@/lib/market-trends/japanese-pricing'
import { runEnglishSpecialist, runJapaneseSpecialist, runTrendAnalyst } from '@/lib/market-trends/agents'

/**
 * Orchestrates the three-role market-trend pipeline (English Specialist,
 * Japanese Specialist, Trend Analyst -- see lib/market-trends/agents.ts)
 * and persists the Analyst's output to public.market_trends
 * (supabase/migrations/0050_market_trends.sql). Same CRON_SECRET-bearer
 * pattern as every other scheduled route in this app.
 *
 * Refuses to run the LLM pipeline at all -- and never writes a row -- while
 * both data sources are still the unwired stubs in english-pricing.ts /
 * japanese-pricing.ts. Persisting AI commentary computed over fabricated
 * placeholder prices would present itself as real "buy raw & grade" advice
 * on /admin/trends, which is worse than showing nothing. This check is the
 * one thing that has to be removed (it removes itself: isPlaceholder flips
 * to false) once a real provider is wired into either fetcher.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [englishData, japaneseData] = await Promise.all([fetchEnglishMarketData(), fetchJapaneseMarketData()])

  if (englishData.isPlaceholder && japaneseData.isPlaceholder) {
    return NextResponse.json({
      skipped: true,
      reason:
        'Both lib/market-trends/english-pricing.ts and japanese-pricing.ts are still unwired stubs (see their header comments) -- nothing was persisted.',
    })
  }

  const [englishReport, japaneseReport] = await Promise.all([
    runEnglishSpecialist(englishData),
    runJapaneseSpecialist(japaneseData),
  ])

  const recommendations = await runTrendAnalyst(englishReport, japaneseReport)

  if (recommendations.length === 0) {
    return NextResponse.json({ inserted: 0, reason: 'Trend Analyst returned no valid recommendations.' })
  }

  const supabase = getSupabaseServerClient()
  const { error } = await supabase.from('market_trends').insert(
    recommendations.map((r) => ({
      card_name: r.cardName,
      set_name: r.setName,
      language: r.language,
      raw_estimate: r.rawEstimate,
      graded_estimate: r.gradedEstimate,
      profit_multiplier: r.profitMultiplier,
      actionable_advice: r.actionableAdvice,
    })),
  )

  if (error) {
    console.error('[market-trends] insert failed', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ inserted: recommendations.length })
}
