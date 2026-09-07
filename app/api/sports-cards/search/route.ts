import { NextRequest, NextResponse } from 'next/server'
import type { Sport } from '@/lib/submission-types'

/**
 * Server-side proxy for the sports card catalog provider used by the
 * "Sports Cards" card-entry flow (components/submit/sports-card-search.tsx),
 * mirroring the existing app/api/pricing/route.ts pattern -- the provider
 * key stays server-side, never sent to the browser.
 *
 * Wired up against The Card API's Catalog search (thecardapi.com/docs),
 * using process.env.THECARDAPI_KEY:
 *   GET https://www.thecardapi.com/api/v1/catalog?q={query}&sport={sport}
 *   header: x-api-key: {THECARDAPI_KEY}
 *   response: { data: [{ ucid, subject, set_name, card_number, year, ... }], pagination: {...} }
 *
 * There's no frontend sport picker -- the search box alone drives this
 * route (see card-shipment-row.tsx) -- but submission_items.sport is a
 * required, constrained column (0025_add_sports_card_fields.sql), and a
 * card object from this provider carries no sport/category field of its
 * own to read it back from (confirmed against their docs: only set_name,
 * card_number, subject, year, etc. are present; sport exists solely as a
 * query-side filter). So rather than guess a sport from set_name text
 * (e.g. "Topps Chrome" says nothing about which sport it's for) or leave
 * it blank, this route queries the provider once per supported sport in
 * parallel and tags each result with whichever query it came back under --
 * real, not fabricated, since we chose that filter ourselves. This is a
 * genuine ~5x request-volume trade-off versus a single filtered query;
 * worth knowing on a metered provider plan.
 *
 * SPORT_TO_API_VALUE maps our five sport codes to the API's sport filter
 * values. 'Soccer'/'Basketball'/'Hockey' are taken directly from their
 * docs' own examples; 'Racing' (for f1) and 'Rugby' (for rugby) are this
 * integration's best-effort guess, not confirmed against those exact
 * strings in the docs -- if either sport starts returning zero results,
 * check the real accepted values in thecardapi.com's dashboard/docs rather
 * than assuming the catalog has no such cards.
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

const SPORT_TO_API_VALUE: Record<Sport, string> = {
  soccer: 'Soccer',
  rugby: 'Rugby',
  f1: 'Racing',
  nhl: 'Hockey',
  nba: 'Basketball',
}

const ALL_SPORTS = Object.keys(SPORT_TO_API_VALUE) as Sport[]

interface SportsCardResult {
  id: string
  sport: Sport
  playerName: string
  year: string | null
  brandSet: string | null
  cardNumber: string | null
}

interface CardApiCard {
  ucid: string
  subject?: string
  set_name?: string
  card_number?: string
  year?: number | string
}

interface CardApiResponse {
  data?: CardApiCard[]
}

async function searchOneSport(
  apiKey: string,
  query: string,
  sport: Sport,
): Promise<{ ok: boolean; results: SportsCardResult[] }> {
  const providerUrl = new URL('https://www.thecardapi.com/api/v1/catalog')
  providerUrl.searchParams.set('q', query)
  providerUrl.searchParams.set('sport', SPORT_TO_API_VALUE[sport])

  let response: Response
  try {
    response = await fetch(providerUrl, { headers: { 'x-api-key': apiKey } })
  } catch (err) {
    console.error('The Card API request failed', sport, err)
    return { ok: false, results: [] }
  }

  if (!response.ok) {
    // Logged server-side only -- the provider's error text can be genuinely
    // useful for diagnosing plan/key issues (e.g. a 403 "Catalog access is
    // not enabled for your key" from a free-tier key) but isn't something
    // to surface verbatim to whoever's filling out the submission form.
    console.error('The Card API error', sport, response.status, await response.text().catch(() => '<no body>'))
    return { ok: false, results: [] }
  }

  const body = (await response.json()) as CardApiResponse
  const cards = Array.isArray(body.data) ? body.data : []

  return {
    ok: true,
    results: cards.map((card) => ({
      id: card.ucid,
      sport,
      playerName: card.subject ?? '',
      year: card.year != null ? String(card.year) : null,
      brandSet: card.set_name ?? null,
      cardNumber: card.card_number ?? null,
    })),
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')?.trim()

  if (!query || query.length < 2) {
    return NextResponse.json({ error: 'A search query of at least 2 characters is required.' }, { status: 400 })
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
  const seen = new Set<string>()
  const deduped = allResults.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))

  return NextResponse.json({ results: deduped.slice(0, 25) })
}
