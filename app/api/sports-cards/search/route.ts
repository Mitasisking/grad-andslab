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
 * SPORT_TO_API_VALUE below maps our five sport codes to the API's sport
 * filter values. 'Soccer'/'Basketball'/'Hockey' are taken directly from
 * their docs' own examples; 'Racing' (for f1) and 'Rugby' (for rugby) are
 * this integration's best-effort guess, not confirmed against those exact
 * strings in the docs -- if either sport starts returning zero results,
 * check the real accepted values in thecardapi.com's dashboard/docs rather
 * than assuming the catalog has no such cards.
 *
 * If THECARDAPI_KEY isn't configured, every request below returns a 501
 * rather than fabricated results -- these results get selected straight
 * into real grading submissions, so silently faking "matches" here would
 * be actively misleading rather than a harmless placeholder. The frontend
 * (components/submit/sports-card-search.tsx) already treats both this and
 * a zero-result search as non-blocking -- its input is bound directly to
 * the card's real name field, so manual entry always works regardless of
 * whether the provider is configured, times out, or finds nothing.
 */

const SPORT_TO_API_VALUE: Record<Sport, string> = {
  soccer: 'Soccer',
  rugby: 'Rugby',
  f1: 'Racing',
  nhl: 'Hockey',
  nba: 'Basketball',
}

interface SportsCardResult {
  id: string
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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')?.trim()
  const sport = searchParams.get('sport') as Sport | null

  if (!query || query.length < 2) {
    return NextResponse.json({ error: 'A search query of at least 2 characters is required.' }, { status: 400 })
  }
  if (!sport || !(sport in SPORT_TO_API_VALUE)) {
    return NextResponse.json({ error: 'A valid sport is required.' }, { status: 400 })
  }

  const apiKey = process.env.THECARDAPI_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Sports card search is not configured yet. Set THECARDAPI_KEY to enable it.' },
      { status: 501 },
    )
  }

  const providerUrl = new URL('https://www.thecardapi.com/api/v1/catalog')
  providerUrl.searchParams.set('q', query)
  providerUrl.searchParams.set('sport', SPORT_TO_API_VALUE[sport])

  let response: Response
  try {
    response = await fetch(providerUrl, { headers: { 'x-api-key': apiKey } })
  } catch {
    return NextResponse.json({ error: 'Could not reach the sports card provider.' }, { status: 502 })
  }

  if (!response.ok) {
    // Logged server-side only -- the provider's error text can be genuinely
    // useful for diagnosing plan/key issues (e.g. a 403 "Catalog access is
    // not enabled for your key" from a free-tier key) but isn't something
    // to surface verbatim to whoever's filling out the submission form.
    console.error('The Card API error', response.status, await response.text().catch(() => '<no body>'))
    return NextResponse.json({ error: 'The sports card provider returned an error.' }, { status: 502 })
  }

  const body = (await response.json()) as CardApiResponse
  const cards = Array.isArray(body.data) ? body.data : []

  const results: SportsCardResult[] = cards.slice(0, 25).map((card) => ({
    id: card.ucid,
    playerName: card.subject ?? '',
    year: card.year != null ? String(card.year) : null,
    brandSet: card.set_name ?? null,
    cardNumber: card.card_number ?? null,
  }))

  return NextResponse.json({ results })
}
