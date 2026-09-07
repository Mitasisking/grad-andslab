import { NextRequest, NextResponse } from 'next/server'
import type { Sport } from '@/lib/submission-types'

/**
 * Server-side proxy for the sports card catalog provider used by the
 * "Sports Cards" card-entry flow (components/submit/sports-card-search.tsx),
 * mirroring the existing app/api/pricing/route.ts pattern -- the provider
 * key stays server-side, never sent to the browser.
 *
 * Wired up against PriceCharting's product search API:
 *   GET https://www.pricecharting.com/api/products?t={PRICECHARTING_API_KEY}&q={query}
 * using process.env.PRICECHARTING_API_KEY.
 *
 * PriceCharting's trading-card catalog doesn't expose separate year/card-number
 * fields the way TCGdex does for Pokemon -- each result only has a free-text
 * `product-name` (typically "YYYY Brand Player #123") and a `console-name`
 * (the brand/set, e.g. "2023 Topps Chrome"). parseProductName() below pulls
 * year and card number out of that title with best-effort regexes; re-check
 * this against real response payloads once a live API key is configured,
 * since this has not been tested against the actual provider.
 *
 * No key is configured in this environment, so until PRICECHARTING_API_KEY
 * is set, every request below returns a 501 rather than fabricated results --
 * these results get selected straight into real grading submissions, so
 * silently faking "matches" here would be actively misleading rather than a
 * harmless placeholder.
 */

const VALID_SPORTS: Sport[] = ['soccer', 'rugby', 'f1', 'nhl', 'nba']

interface SportsCardResult {
  id: string
  playerName: string
  year: string | null
  brandSet: string | null
  cardNumber: string | null
}

interface PriceChartingProduct {
  id: string | number
  'product-name'?: string
  'console-name'?: string
}

function parseProductName(name: string): { year: string | null; cardNumber: string | null; playerName: string } {
  const yearMatch = name.match(/\b(19|20)\d{2}\b/)
  const numberMatch = name.match(/#\s?([A-Za-z0-9-]+)/)

  let playerName = name
  if (yearMatch) playerName = playerName.replace(yearMatch[0], '')
  if (numberMatch) playerName = playerName.replace(numberMatch[0], '')

  return {
    year: yearMatch?.[0] ?? null,
    cardNumber: numberMatch?.[1] ?? null,
    playerName: playerName.replace(/\s+/g, ' ').trim(),
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')?.trim()
  const sport = searchParams.get('sport') as Sport | null

  if (!query) {
    return NextResponse.json({ error: 'A search query is required.' }, { status: 400 })
  }
  if (!sport || !VALID_SPORTS.includes(sport)) {
    return NextResponse.json({ error: 'A valid sport is required.' }, { status: 400 })
  }

  const apiKey = process.env.PRICECHARTING_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Sports card search is not configured yet. Set PRICECHARTING_API_KEY to enable it.' },
      { status: 501 },
    )
  }

  const providerUrl = `https://www.pricecharting.com/api/products?t=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(`${sport} ${query}`)}`

  let response: Response
  try {
    response = await fetch(providerUrl)
  } catch {
    return NextResponse.json({ error: 'Could not reach the sports card provider.' }, { status: 502 })
  }

  if (!response.ok) {
    return NextResponse.json({ error: 'The sports card provider returned an error.' }, { status: 502 })
  }

  const data = await response.json()
  const rawProducts: PriceChartingProduct[] = Array.isArray(data.products) ? data.products : []

  const results: SportsCardResult[] = rawProducts.slice(0, 25).map((p) => {
    const { year, cardNumber, playerName } = parseProductName(p['product-name'] ?? '')
    return {
      id: String(p.id),
      playerName,
      year,
      brandSet: p['console-name'] ?? null,
      cardNumber,
    }
  })

  return NextResponse.json({ results })
}
