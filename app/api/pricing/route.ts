import { NextRequest, NextResponse } from 'next/server'

/**
 * Server-side proxy for the market pricing provider used to auto-populate
 * declared value during submission (Phase 2, Step 1).
 *
 * Wire up a real provider by replacing `pseudoEstimate` below with a fetch to:
 *   - TCGplayer:     https://api.tcgplayer.com/pricing/product/{productId}
 *                     using process.env.TCGPLAYER_API_KEY (OAuth bearer token)
 *   - PriceCharting: https://www.pricecharting.com/api/product
 *                     using process.env.PRICECHARTING_API_KEY as a query param
 *
 * Keeping the provider call server-side means these keys are never sent
 * to the browser. Until real credentials are configured, this returns a
 * deterministic pseudo-estimate so the UI behaves consistently in dev.
 */

function pseudoEstimate(seed: string): number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  const dollars = (hash % 48000) / 100 // spreads across roughly $0 - $480
  return Math.max(0.25, Math.round(dollars * 100) / 100)
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const cardName = searchParams.get('cardName')?.trim()
  const setName = searchParams.get('setName')?.trim()

  if (!cardName || !setName) {
    return NextResponse.json({ error: 'cardName and setName are required' }, { status: 400 })
  }

  // Deterministic stand-in until real provider credentials are wired up above.
  const estimate = pseudoEstimate(`${cardName.toLowerCase()}|${setName.toLowerCase()}`)

  return NextResponse.json({
    estimate,
    source: 'pricecharting',
    cardName,
    setName,
  })
}
