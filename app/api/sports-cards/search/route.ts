import { NextRequest, NextResponse } from 'next/server'
import type { Sport } from '@/lib/submission-types'

/**
 * Server-side proxy for the sports card catalog provider used by the
 * "Sports Cards" card-entry flow (components/submit/sports-card-search.tsx),
 * mirroring the existing app/api/pricing/route.ts pattern -- the provider
 * key stays server-side, never sent to the browser.
 *
 * Wired up against The Card API's Market Sales search (thecardapi.com/docs),
 * using process.env.THECARDAPI_KEY -- switched from the Catalog endpoint
 * (app/api/sports-cards/search/route.ts's previous version) because Catalog
 * access needs a higher plan tier than this key currently has:
 *   GET https://thecardapi.com/api/v1/market/sales?q={query}
 *   header: x-market-api-key: {THECARDAPI_KEY}   (NOT x-api-key -- Sales
 *     and Catalog use two different header names on this provider)
 *   response: { data: [{ id, title, player?, card_set?, card_number?,
 *                         year?, manufacturer?, category, ... }] }
 *
 * Sales records are individual sale transactions, not a card catalog, so:
 *
 * 1. Most results carry no structured player/card_set/card_number/year --
 *    per their docs only ~0.3-0.4% of records are "catalog-matched" with
 *    those fields populated. parseTitle() below extracts a best-effort
 *    guess from the free-text `title` (e.g. "2021 Bowman Chrome Kyle
 *    Harrison Auto PSA 10") when the structured fields are absent -- this
 *    is inherently weaker than a real catalog lookup and can misparse
 *    unusual titles; it's a fallback, not a source of truth.
 *
 * 2. The same physical card gets sold many times, so results are deduped
 *    by their derived (player, year, set, card number) identity rather
 *    than by sale id (which is unique per individual sale and would
 *    defeat deduping entirely).
 *
 * 3. Sport: this endpoint has neither a specific-sport filter parameter
 *    nor a specific-sport response field -- `category` only distinguishes
 *    sports/tcg/non_sport, not which sport. There is no reliable way to
 *    attribute a sale record to one of our 5 supported sports (soccer,
 *    rugby, f1, nhl, nba) from this data source the way the Catalog
 *    endpoint's sport filter allowed. SPORT_KEYWORDS below folds each
 *    sport's name into a parallel per-sport query as a text-match
 *    heuristic (same "tag by which query it matched" principle as the
 *    Catalog version), but unlike Catalog this is genuinely unreliable --
 *    most listing titles don't mention the sport by name at all, so this
 *    will under-match real results rather than mistag them. Flagged
 *    clearly to the user rather than presented as equivalent to the
 *    Catalog version's tagging.
 *
 * If THECARDAPI_KEY isn't configured, or every one of the five queries
 * fails, this returns a 501/502 rather than fabricated results -- these
 * results get selected straight into real grading submissions, so
 * silently faking "matches" here would be actively misleading rather than
 * a harmless placeholder. The frontend already treats both cases as
 * non-blocking -- its input is bound directly to the card's real name
 * field, so manual entry always works regardless of whether the provider
 * is configured, times out, or finds nothing (though without a picked
 * result, sport never gets set -- see the canAdvanceFromStep1 check in
 * app/submit/wizard.tsx, which requires one for sports-card rows).
 */

const SPORT_KEYWORD: Record<Sport, string> = {
  soccer: 'soccer',
  rugby: 'rugby',
  f1: 'f1',
  nhl: 'nhl',
  nba: 'nba',
}

const ALL_SPORTS = Object.keys(SPORT_KEYWORD) as Sport[]

interface SportsCardResult {
  id: string
  sport: Sport
  playerName: string
  year: string | null
  brandSet: string | null
  cardNumber: string | null
}

interface SaleRecord {
  id: string | number
  title?: string
  player?: string | null
  card_set?: string | null
  card_number?: string | null
  year?: number | string | null
  manufacturer?: string | null
}

interface SalesApiResponse {
  data?: SaleRecord[]
}

// Real eBay-style listing titles bury the player name in brand, grading,
// and sport noise (e.g. "-19 Panini Donruss Lionel Messi Press Proof Red
// FC Barcelona Soccer PSA 10"). This is a best-effort cleanup, not a
// reliable parse -- there's no guarantee the remainder after stripping all
// of this is actually just the player's name, especially for titles that
// don't follow the common "brand ... player ... grade" shape. The three
// card-entry fields this produces (Brand/Set, Card Number, and whatever's
// left of Player Name) stay user-editable in the UI specifically because
// of this.
const KNOWN_BRANDS = [
  'Topps Chrome',
  'Topps Finest',
  'Topps',
  'Panini Prizm',
  'Panini Donruss',
  'Panini Select',
  'Panini Mosaic',
  'Panini Obsidian',
  'Panini Contenders',
  'Panini Chronicles',
  'Panini Immaculate',
  'Panini Flawless',
  'Panini National Treasures',
  'Panini',
  'Donruss',
  'Bowman Chrome',
  'Bowman',
  'Upper Deck',
  'Leaf',
  'Fleer',
  'Score',
]

const GRADING_NOISE = /\b(PSA|BGS|SGC|CGC|CSG)\s?\d+(\.\d+)?\b|\bGEM\s?MI?N?T\b|\bNM-MT\b|\bMINT\b/gi
const SPORT_NOISE = /\b(soccer|basketball|football|baseball|hockey|rugby|racing|nba|nfl|nhl|mlb|f1)\b/gi

function parseTitle(title: string): {
  year: string | null
  cardNumber: string | null
  brandSetGuess: string | null
  playerNameGuess: string
} {
  const yearMatch = title.match(/\b(19|20)\d{2}\b/)
  const numberMatch = title.match(/#\s?([A-Za-z0-9-]+)/)

  const brandMatch = KNOWN_BRANDS.find((brand) => title.toLowerCase().includes(brand.toLowerCase()))

  let remainder = title
  if (yearMatch) remainder = remainder.replace(yearMatch[0], '')
  if (numberMatch) remainder = remainder.replace(numberMatch[0], '')
  if (brandMatch) remainder = remainder.replace(new RegExp(brandMatch, 'i'), '')
  remainder = remainder.replace(GRADING_NOISE, '').replace(SPORT_NOISE, '')
  // Leftover punctuation from stripped-out tokens (e.g. "- Lionel Messi -").
  remainder = remainder.replace(/[-•|,]/g, ' ')

  return {
    year: yearMatch?.[0] ?? null,
    cardNumber: numberMatch?.[1] ?? null,
    brandSetGuess: brandMatch ?? null,
    playerNameGuess: remainder.replace(/\s+/g, ' ').trim(),
  }
}

function toResult(record: SaleRecord, sport: Sport): SportsCardResult {
  const parsed = parseTitle(record.title ?? '')
  return {
    id: String(record.id),
    sport,
    playerName: record.player ?? parsed.playerNameGuess,
    year: record.year != null ? String(record.year) : parsed.year,
    brandSet: record.card_set ?? record.manufacturer ?? parsed.brandSetGuess,
    cardNumber: record.card_number ?? parsed.cardNumber,
  }
}

async function searchOneSport(
  apiKey: string,
  query: string,
  sport: Sport,
): Promise<{ ok: boolean; results: SportsCardResult[] }> {
  const providerUrl = new URL('https://thecardapi.com/api/v1/market/sales')
  providerUrl.searchParams.set('q', `${query} ${SPORT_KEYWORD[sport]}`)

  let response: Response
  try {
    response = await fetch(providerUrl, { headers: { 'x-market-api-key': apiKey } })
  } catch (err) {
    console.error('The Card API (sales) request failed', sport, err)
    return { ok: false, results: [] }
  }

  if (!response.ok) {
    // Logged server-side only -- the provider's error text can be genuinely
    // useful for diagnosing plan/key issues but isn't something to surface
    // verbatim to whoever's filling out the submission form.
    console.error('The Card API (sales) error', sport, response.status, await response.text().catch(() => '<no body>'))
    return { ok: false, results: [] }
  }

  const body = (await response.json()) as SalesApiResponse
  const records = Array.isArray(body.data) ? body.data : []

  return { ok: true, results: records.map((record) => toResult(record, sport)) }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')?.trim()

  // The Sales API's own minimum is 4 characters (vs. Catalog's 2), see
  // thecardapi.com/docs.
  if (!query || query.length < 4) {
    return NextResponse.json({ error: 'A search query of at least 4 characters is required.' }, { status: 400 })
  }

  const apiKey = process.env.THECARDAPI_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Sports card search is not configured yet. Set THECARDAPI_KEY to enable it.' },
      { status: 501 },
    )
  }

  const perSport = await Promise.all(ALL_SPORTS.map((sport) => searchOneSport(apiKey, query, sport)))

  // Distinguish "every one of the 5 queries actually failed" (a real error,
  // worth surfacing) from "they all succeeded but nothing matched" (not an
  // error -- just an empty, non-blocking result set). searchOneSport already
  // logged the specific reason per sport for the former case.
  if (perSport.every((r) => !r.ok)) {
    return NextResponse.json({ error: 'The sports card provider returned an error.' }, { status: 502 })
  }

  const allResults = perSport.flatMap((r) => r.results)

  // Dedupe by derived card identity, not sale id -- the same card sells
  // many times, and each sale has its own unique id.
  const seen = new Set<string>()
  const deduped = allResults.filter((r) => {
    const key = `${r.playerName.toLowerCase()}|${r.year ?? ''}|${(r.brandSet ?? '').toLowerCase()}|${r.cardNumber ?? ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return NextResponse.json({ results: deduped.slice(0, 25) })
}
