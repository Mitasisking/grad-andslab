import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase-server'

const FROM_CURRENCY = 'GBP'
const TO_CURRENCY = 'ZAR'
const DEFAULT_BUFFER_PERCENT = 3.5

interface OpenErApiResponse {
  result: string
  rates?: Record<string, number>
}

/**
 * Syncs the GBP->ZAR rate PCG/ACE grading tiers are priced against (see
 * supabase/migrations/0049_exchange_rates.sql's header for why this exists
 * and why it's pg_cron-scheduled rather than a Vercel Cron). Same
 * CRON_SECRET-bearer pattern as every other scheduled route in this app
 * (app/api/auctions/close, app/api/shop/orders/release-stale) -- no user
 * session of its own, meant to be invoked by pg_cron, not a browser.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServerClient()

  let apiData: OpenErApiResponse
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${FROM_CURRENCY}`)
    if (!res.ok) {
      return NextResponse.json({ error: `Rate provider returned ${res.status}` }, { status: 502 })
    }
    apiData = await res.json()
  } catch (err) {
    console.error('[update-exchange-rate] fetch failed', err)
    return NextResponse.json({ error: 'Could not reach rate provider' }, { status: 502 })
  }

  const spotRate = apiData.result === 'success' ? apiData.rates?.[TO_CURRENCY] : undefined
  if (!spotRate || !Number.isFinite(spotRate) || spotRate <= 0) {
    console.error('[update-exchange-rate] malformed provider response', apiData)
    return NextResponse.json({ error: 'Rate provider response did not include a valid ZAR rate' }, { status: 502 })
  }

  // Preserves a manually-adjusted buffer_percent across syncs (an admin who
  // widens/narrows the markup by hand shouldn't have it silently reset back
  // to the 3.5% default on the next scheduled run) -- falls back to the
  // default only when no row has ever been written yet.
  const { data: previous, error: previousError } = await supabase
    .from('exchange_rates')
    .select('buffer_percent')
    .eq('from_currency', FROM_CURRENCY)
    .eq('to_currency', TO_CURRENCY)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // A failed lookup here must not fall through to DEFAULT_BUFFER_PERCENT --
  // this table is append-only, so a silently-defaulted row becomes the
  // "previous" row every sync reads from next, permanently discarding an
  // admin's custom buffer_percent instead of just skipping one sync.
  if (previousError) {
    console.error('[update-exchange-rate] could not read previous buffer_percent', previousError.message)
    return NextResponse.json({ error: previousError.message }, { status: 500 })
  }

  const bufferPercent = previous ? Number(previous.buffer_percent) : DEFAULT_BUFFER_PERCENT
  const effectiveRate = spotRate * (1 + bufferPercent / 100)

  const { data: inserted, error } = await supabase
    .from('exchange_rates')
    .insert({
      from_currency: FROM_CURRENCY,
      to_currency: TO_CURRENCY,
      spot_rate: spotRate,
      buffer_percent: bufferPercent,
      effective_rate: effectiveRate,
    })
    .select('id, spot_rate, buffer_percent, effective_rate, updated_at')
    .single()

  if (error) {
    console.error('[update-exchange-rate] insert failed', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ synced: true, rate: inserted })
}
