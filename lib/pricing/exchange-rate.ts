import { getSupabaseServerClient } from '@/lib/supabase-server'

const FROM_CURRENCY = 'GBP'
const TO_CURRENCY = 'ZAR'

export interface ExchangeRate {
  spotRate: number
  bufferPercent: number
  effectiveRate: number
  updatedAt: string
}

/**
 * Reads the most recent GBP->ZAR row written by
 * app/api/cron/update-exchange-rate (supabase/migrations/0049_exchange_rates.sql
 * is append-only, so "latest" is always "most recently synced", not an
 * upsert target). Server-only -- exchange_rates is publicly SELECT-able via
 * RLS, but this uses the service-role client the same way every other
 * server-only lib helper in this app does, since callers here (submission
 * pricing, fee calculators) already run server-side.
 */
export async function getLatestGbpZarRate(): Promise<ExchangeRate | null> {
  const supabase = getSupabaseServerClient()
  const { data, error } = await supabase
    .from('exchange_rates')
    .select('spot_rate, buffer_percent, effective_rate, updated_at')
    .eq('from_currency', FROM_CURRENCY)
    .eq('to_currency', TO_CURRENCY)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('getLatestGbpZarRate: lookup failed', error.message)
    return null
  }
  if (!data) return null

  return {
    spotRate: Number(data.spot_rate),
    bufferPercent: Number(data.buffer_percent),
    effectiveRate: Number(data.effective_rate),
    updatedAt: data.updated_at,
  }
}

/**
 * Converts a GBP amount to ZAR using the latest buffered rate. Returns null
 * -- not a stale hardcoded guess -- if the cron sync has never run yet;
 * callers decide what to fall back to in that case (e.g.
 * lib/submission-types.ts's existing hand-set basePriceZAR) rather than
 * this function silently making a number up.
 */
export async function convertGbpToZar(amountGbp: number): Promise<number | null> {
  const rate = await getLatestGbpZarRate()
  if (!rate) return null
  return Math.round(amountGbp * rate.effectiveRate * 100) / 100
}

/**
 * Inverse of convertGbpToZar, for display contexts that show a ZAR-primary
 * figure with its GBP equivalent alongside (e.g. app/admin/financials/page.tsx)
 * rather than converting a real charge. Takes an already-fetched rate
 * instead of looking one up itself, since a page rendering several
 * ZAR->GBP figures at once should fetch the rate exactly once, not once
 * per figure.
 */
export function zarToGbp(amountZar: number, rate: ExchangeRate): number {
  return Math.round((amountZar / rate.effectiveRate) * 100) / 100
}
