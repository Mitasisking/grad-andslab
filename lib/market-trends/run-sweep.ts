import { getSupabaseServerClient } from '@/lib/supabase-server'
import { fetchEnglishMarketData } from './english-pricing'
import { fetchJapaneseMarketData } from './japanese-pricing'
import { runEnglishSpecialist, runJapaneseSpecialist, runTrendAnalyst } from './agents'

export type SweepResult = { skipped: true; reason: string } | { inserted: number; reason?: string } | { error: string }

/**
 * The actual English Specialist / Japanese Specialist / Trend Analyst
 * pipeline (agents.ts), shared by the twice-daily cron
 * (app/api/cron/market-trends/route.ts) and the admin-triggered manual sweep
 * (app/api/admin/trends/sweep/route.ts) so there's exactly one place that
 * decides when it's safe to persist a row -- refuses to run the LLM pipeline
 * at all, from either trigger, while both pricing sources are still the
 * unwired stubs in english-pricing.ts/japanese-pricing.ts (see this
 * function's isPlaceholder check below).
 */
export async function runMarketTrendsSweep(): Promise<SweepResult> {
  const [englishData, japaneseData] = await Promise.all([fetchEnglishMarketData(), fetchJapaneseMarketData()])

  if (englishData.isPlaceholder && japaneseData.isPlaceholder) {
    return {
      skipped: true,
      reason:
        'Both lib/market-trends/english-pricing.ts and japanese-pricing.ts are still unwired stubs (see their header comments) -- nothing was persisted.',
    }
  }

  const [englishReport, japaneseReport] = await Promise.all([
    runEnglishSpecialist(englishData),
    runJapaneseSpecialist(japaneseData),
  ])

  const recommendations = await runTrendAnalyst(englishReport, japaneseReport)

  if (recommendations.length === 0) {
    return { inserted: 0, reason: 'Trend Analyst returned no valid recommendations.' }
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
    return { error: error.message }
  }

  return { inserted: recommendations.length }
}
