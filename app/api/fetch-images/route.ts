import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/require-admin'
import { getSupabaseServerClient } from '@/lib/supabase-server'

/**
 * Manual admin migration utility: backfills products.images for rows
 * imported from Collectr's export.csv, which carries a set name and a
 * local card number but no image URL. Visit this route (as an admin) once
 * after an import to fill in anything still missing its images.
 *
 * - category = 'sealed': matches products.set_name against TCGdex's set
 *   list and saves the official set logo.
 * - category = 'cards': matches products.set_name the same way, then looks
 *   up the specific card by local number within that set. If the set
 *   resolved but doesn't have that number in its resolved language, the
 *   same set id is retried in the other language before giving up on it.
 *   If no set matched at all, or neither language of the resolved set had
 *   that number, a last-resort safety net searches TCGdex's whole card
 *   index by name (see findCardBySafetyNet) and filters to the matching
 *   local id — this is what actually recovers a card whose set_name never
 *   resolves to anything (wrong/unknown/Collectr-only set name), as long
 *   as the card itself exists somewhere in TCGdex's catalog.
 *   Before any of that, CARD_OVERRIDES is checked for the exact
 *   set_name + card_number Collectr recorded — a manual escape hatch for
 *   rows none of the automatic matching can safely resolve on its own,
 *   e.g. two same-named prints in one set (see the ambiguity guard in
 *   finalizeCardMatch) or a card filed under the wrong set entirely.
 *
 * Gated by requireAdmin() in production — this writes to every product
 * row, and the app is live there, so "just visit the URL" can't mean
 * unauthenticated. Locally (NODE_ENV !== 'production'), that gate is
 * skipped in favor of the service-role client directly, so it really can
 * be triggered by just visiting the URL during development — see the
 * matching branch in app/api/admin/import-products/route.ts.
 *
 * SET_NAME_OVERRIDES exists because TCGdex's English sets list simply does
 * not contain Japan-exclusive sets, and TCGdex's Japanese sets list has
 * them only under native-script names ("拡張パック", not "MEGA Dream ex")
 * -- there is no romanized field anywhere in that API to match Collectr's
 * set_name against automatically. These entries were matched by hand
 * (phonetic transliteration, e.g. メガドリームex -> "MEGA Dream ex"), not
 * fetched from anywhere authoritative, so verify them if a wrong image
 * shows up.
 *
 * "Raging Surf", "Shiny Treasure ex", and "Triplet Beat" all used to be
 * unresolved because TCGdex's own `name` field mislabels several unrelated
 * ids with the same Japanese name:
 *   - SV3a/SV4a both show as "レイジングサーフ". SV3a is the real Raging
 *     Surf (92 cards, no secret-rare tail); SV4a's highest local ids are
 *     Koraidon ex / Miraidon ex / the Treasures of Ruin ex cards as secret
 *     rares -- the signature chase cards of Shiny Treasure ex, whose
 *     320-card total (190 official + a ~130-card shiny-vault tail) is
 *     unlike anything else in this generation.
 *   - Sixteen ids show as "トリプレットビート", fifteen of which are
 *     identical to each other (same 2024-04-26 release date, same 101-card
 *     total) -- clearly a batch mislabeling of some unrelated "Trainer's
 *     Deck"-style product, not sixteen real Triplet Beat variants. SV1a is
 *     the one outlier (2023-03-10, 73 official cards) and its highest local
 *     ids are Meowscarada ex / Skeledirge ex / Quaquaval ex -- the three
 *     starter-final-evolution ex cards the set is named for.
 *
 * "Nihil Zero" -> M3 (Japanese name "ムニキスゼロ", which doesn't obviously
 * romanize to "Nihil Zero" at all -- found instead by searching individual
 * card names from the ten products stuck on this set_name, e.g. "Mega
 * Clefable ex", which turned up in M3's Japanese card list. Confirmed, not
 * guessed: all ten of those products' card_number values (091/080, 093/080,
 * ...) exist as exact local ids in M3, and M3's own official card count is
 * 80 -- matching the "/080" denominator on every one of them.
 *
 * Still-unresolved:
 *   - "The Pokedex": confirmed with the business this isn't a real,
 *     purchasable TCG set at all (a custom Collectr checklist, not a
 *     product) -- deliberately left out of this table; it's expected to
 *     always report unresolved.
 *
 * Also worth knowing going in: of TCGdex's 184 Japanese sets, zero have a
 * `logo` field populated. A correct id in this table still won't get a
 * sealed Japanese product (a booster box, etc.) an image -- that asset
 * doesn't exist in TCGdex's data at all. This table only actually helps
 * the `cards` category.
 */
const SET_NAME_OVERRIDES: Record<string, { setId: string; lang: 'en' | 'ja' }> = {
  'MEGA Dream ex': { setId: 'M2a', lang: 'ja' },
  'Paradigm Trigger': { setId: 'S12', lang: 'ja' },
  'Mega Symphonia': { setId: 'M1S', lang: 'ja' },
  'Future Flash': { setId: 'SV4M', lang: 'ja' },
  'Paradise Dragona': { setId: 'SV7a', lang: 'ja' },
  'Scarlet ex': { setId: 'SV1S', lang: 'ja' },
  'Mask of Change': { setId: 'SV6', lang: 'ja' },
  'Ancient Roar': { setId: 'SV4K', lang: 'ja' },
  'Cyber Judge': { setId: 'SV5M', lang: 'ja' },
  'Space Juggler': { setId: 'S10P', lang: 'ja' },
  'Violet ex': { setId: 'SV1V', lang: 'ja' },
  'Hot Air Arena': { setId: 'SV9a', lang: 'ja' },
  'Clay Burst': { setId: 'SV2D', lang: 'ja' },
  'Crimson Haze': { setId: 'SV5a', lang: 'ja' },
  'Battle Partners': { setId: 'SV9', lang: 'ja' },
  'Jet Black Geist': { setId: 'S6K', lang: 'ja' },
  'Mega Evolution Promos': { setId: 'M-P', lang: 'ja' },
  'Snow Hazard': { setId: 'SV2P', lang: 'ja' },
  'Start Deck 100 Battle Collection': { setId: 'MC', lang: 'ja' },
  'Time Gazer': { setId: 'S10D', lang: 'ja' },
  'Inferno X': { setId: 'M2', lang: 'ja' },
  'Raging Surf': { setId: 'SV3a', lang: 'ja' },
  'Shiny Treasure ex': { setId: 'SV4a', lang: 'ja' },
  'Triplet Beat': { setId: 'SV1a', lang: 'ja' },
  'Nihil Zero': { setId: 'M3', lang: 'ja' },
}

/**
 * Per-product corrections for rows where Collectr's card_number (or even
 * set_name) points at the wrong physical card, and neither the same-set
 * nor cross-set automatic matching in processProduct/finalizeCardMatch can
 * safely resolve it on their own. Unlike SET_NAME_OVERRIDES (which retargets
 * an entire set_name), this retargets one exact set_name + card_number pair
 * -- other products under the same set_name are unaffected.
 *
 * Confirmed by visually comparing both candidate prints against the
 * physical/Collectr card (Black Bolt / White Flare review, 2026-09-05):
 *   - Beartic and Haxorus: Black Bolt has two same-named prints of each,
 *     so finalizeCardMatch's ambiguity guard correctly refused to pick
 *     one automatically even after Collectr's card_number was found to
 *     point at an unrelated card (Eelektrik / Minccino respectively).
 *     Confirmed correct print in both cases: the Illustration Rare.
 *   - Lampent: filed under Black Bolt in Collectr, but doesn't appear in
 *     that set on TCGdex at all -- the real print is in White Flare
 *     (Black Bolt's sibling set), also as the Illustration Rare.
 *   - Sigilyph and Patrat: same pattern as Beartic/Haxorus, but in White
 *     Flare -- Collectr's numbers point at unrelated cards (Stunfisk /
 *     Druddigon) and both names have two same-named prints in White
 *     Flare. Confirmed correct print in both cases: the Illustration Rare.
 *   - Klang: the mirror of Lampent -- filed under White Flare in
 *     Collectr, but its real print is in Black Bolt, also as the
 *     Illustration Rare.
 */
const CARD_OVERRIDES: Record<string, { setId: string; lang: 'en' | 'ja'; localId: string }> = {
  'Black Bolt#114/086': { setId: 'sv10.5b', lang: 'en', localId: '110' }, // Beartic -> Illustration Rare
  'Black Bolt#152/086': { setId: 'sv10.5b', lang: 'en', localId: '147' }, // Haxorus -> Illustration Rare
  'Black Bolt#101/086': { setId: 'sv10.5w', lang: 'en', localId: '102' }, // Lampent -> White Flare, Illustration Rare
  'White Flare#118/086': { setId: 'sv10.5w', lang: 'en', localId: '121' }, // Sigilyph -> Illustration Rare
  'White Flare#151/086': { setId: 'sv10.5w', lang: 'en', localId: '152' }, // Patrat -> Illustration Rare
  'White Flare#147/086': { setId: 'sv10.5b', lang: 'en', localId: '140' }, // Klang -> Black Bolt, Illustration Rare
}

function cardOverrideKey(setName: string, cardNumber: string): string {
  return `${setName}#${cardNumber}`
}

const FLUFF_WORDS = ['booster box', 'booster bundle', 'booster pack', 'elite trainer box', 'bundle', 'box', 'pack']

function normalizeSetName(name: string): string {
  let normalized = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents (e.g. "é" -> "e") so Collectr's spelling matches TCGdex's
    .toLowerCase()
    .replace(/\s+/g, ' ') // collapse doubled/irregular whitespace before fluff-word matching below
    .trim()
  for (const fluff of FLUFF_WORDS) {
    normalized = normalized.replaceAll(fluff, '')
  }
  return normalized.replace(/[^a-z0-9]/g, '')
}

interface TcgdexSetSummary {
  id: string
  name: string
  logo?: string
}

interface TcgdexCardSummary {
  id: string
  localId: string
  name?: string
}

interface TcgdexSetDetail {
  logo?: string
  releaseDate?: string
  cards?: TcgdexCardSummary[]
}

interface TcgdexCardDetail {
  name?: string
  image?: string
}

/**
 * TCGdex has no documented timeout of its own, and a hung connection would
 * otherwise stall an entire concurrency batch indefinitely -- so every
 * request here gets a hard client-side cutoff instead of relying on
 * whatever Node's default (if any) happens to be.
 */
const TCGDEX_TIMEOUT_MS = 10_000

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TCGDEX_TIMEOUT_MS)
  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Observed directly against the live API: TCGdex flaps between a 200 and a
 * 503/504 within the same few seconds -- not a sustained outage -- so a
 * single failed attempt isn't reliable evidence a card has no image, just
 * that this one request landed on a bad moment. Two retries with backoff
 * (attempts at 0ms, 500ms, 1500ms) before giving up for good.
 */
const CARD_DETAIL_MAX_ATTEMPTS = 3
const CARD_DETAIL_RETRY_BASE_MS = 500

/**
 * The set-detail endpoint's embedded `cards` array is a lightweight
 * summary (id/localId/name only) -- it never carries `image`, for any
 * card, in any set. The actual image lives on the individual card record,
 * which needs its own fetch. Matches the two-step pattern the legacy
 * dashboard's card search already used for exactly this reason.
 *
 * Network failures and timeouts are retried (see CARD_DETAIL_MAX_ATTEMPTS)
 * rather than immediately treated as "no image" -- but a non-5xx status
 * (404, most likely) is a real answer, not a transient failure, so that
 * returns null right away instead of burning retries on it. Only a
 * failure that persists across every attempt is caught and logged here
 * rather than left to bubble up -- TCGdex being down for one card
 * shouldn't take out the whole batch it's part of.
 */
async function fetchCardDetail(cardId: string, lang: 'en' | 'ja'): Promise<TcgdexCardDetail | null> {
  let lastError: unknown
  for (let attempt = 1; attempt <= CARD_DETAIL_MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetchWithTimeout(`https://api.tcgdex.net/v2/${lang}/cards/${cardId}`)
      if (res.ok) return (await res.json()) as TcgdexCardDetail
      if (res.status < 500) return null
      lastError = new Error(`HTTP ${res.status}`)
    } catch (err) {
      lastError = err
    }
    if (attempt < CARD_DETAIL_MAX_ATTEMPTS) {
      await sleep(CARD_DETAIL_RETRY_BASE_MS * 2 ** (attempt - 1))
    }
  }
  console.error(
    `[fetch-images] card detail request failed for ${lang}/${cardId} after ${CARD_DETAIL_MAX_ATTEMPTS} attempts:`,
    lastError instanceof Error ? lastError.message : lastError,
  )
  return null
}

interface TcgdexCardSearchResult {
  id: string
  localId: string
}

/**
 * Last-resort lookup, tried only once both the resolved set (and its
 * cross-language counterpart) have failed to produce a match: search
 * TCGdex's global card index by name instead of going through a specific
 * set at all. Catches cards whose set_name never resolved to any TCGdex
 * set (wrong/unknown set name, or a set TCGdex genuinely doesn't have),
 * as long as the card itself exists somewhere in TCGdex's catalog.
 */
async function searchCardsByName(name: string, lang: 'en' | 'ja'): Promise<TcgdexCardSearchResult[]> {
  try {
    const res = await fetchWithTimeout(`https://api.tcgdex.net/v2/${lang}/cards?name=${encodeURIComponent(name)}`)
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? (data as TcgdexCardSearchResult[]) : []
  } catch (err) {
    console.error(`[fetch-images] card name search failed for ${lang}/"${name}":`, err instanceof Error ? err.message : err)
    return []
  }
}

/** Strips "(JP)", "(Poke Ball Pattern)", etc. before using a title as a search query. */
function stripVariantTag(title: string): string {
  return title.replace(/\(.*?\)/g, '').trim()
}

/**
 * A wrong card_number in the source data (Collectr, in practice -- not
 * something this route or the importer introduces) still resolves to a
 * *real* card by number, just the wrong one -- e.g. Collectr's own export
 * pairs "Zorua" with card 058/086 in White Flare, and TCGdex confirms card
 * 058 there is actually Scrafty. Matching by number alone can't catch
 * that; this compares the matched card's actual name against the product
 * title so a wrong number gets flagged instead of silently saving whatever
 * image that number happens to point to.
 *
 * English-only: TCGdex's Japanese card names are native script
 * (e.g. "アセロラのいたずら"), so comparing them against a Latin-script
 * product title can't produce a real answer -- it would either match
 * nothing ever (all false positives) or need a translation step, which
 * has the same unreliability problem already ruled out for set names.
 * Japanese-resolved matches are saved but explicitly labeled unverified
 * rather than silently treated as checked.
 */
function normalizeCardName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents (e.g. "é" -> "e") so "Poké Pad" matches "Poke Pad"
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function namesLikelyMatch(productTitle: string, tcgdexName: string): boolean {
  const a = normalizeCardName(productTitle)
  const b = normalizeCardName(tcgdexName)
  if (!a || !b) return true
  return a.includes(b) || b.includes(a)
}

/**
 * Collectr's Card Number column (e.g. "077/066") and TCGdex's own localId
 * for the same physical card don't always agree on zero-padding — try the
 * value as Collectr gives it, then with leading zeros stripped, then
 * re-padded to the widths TCGdex commonly uses for this generation of sets.
 */
function candidateLocalIds(cardNumber: string): string[] {
  const raw = cardNumber.split('/')[0].trim()
  const asNumber = Number.parseInt(raw, 10)
  if (Number.isNaN(asNumber)) return [raw]
  const stripped = String(asNumber)
  return Array.from(new Set([raw, stripped, stripped.padStart(2, '0'), stripped.padStart(3, '0')]))
}

async function fetchSetsList(lang: 'en' | 'ja'): Promise<TcgdexSetSummary[]> {
  const res = await fetchWithTimeout(`https://api.tcgdex.net/v2/${lang}/sets`)
  if (!res.ok) throw new Error(`TCGdex sets list request failed (${res.status})`)
  return (await res.json()) as TcgdexSetSummary[]
}

// Same "log and degrade, don't throw" treatment as fetchCardDetail above --
// a set TCGdex can't currently answer for just reports as unresolved for
// every product in it, instead of failing the whole run.
async function fetchSetDetail(setId: string, lang: 'en' | 'ja'): Promise<TcgdexSetDetail | null> {
  try {
    const res = await fetchWithTimeout(`https://api.tcgdex.net/v2/${lang}/sets/${setId}`)
    if (!res.ok) return null
    return (await res.json()) as TcgdexSetDetail
  } catch (err) {
    console.error(`[fetch-images] set detail request failed for ${lang}/${setId}:`, err instanceof Error ? err.message : err)
    return null
  }
}

interface ProductRow {
  id: string
  title: string
  category: string
  set_name: string | null
  card_number: string | null
  images: string[]
  release_date: string | null
}

interface ResolvedSet {
  id: string
  lang: 'en' | 'ja'
  logo?: string
}

export async function GET() {
  // Local-dev-only convenience, same shape and same NODE_ENV gate as
  // app/api/admin/import-products/route.ts: skip the admin-session cookie
  // dance so this can be triggered by just visiting the URL while
  // iterating. Cannot activate on Vercel regardless of what ships in the
  // bundle — NODE_ENV is 'production' there, production and preview alike.
  let supabase: SupabaseClient
  if (process.env.NODE_ENV !== 'production') {
    supabase = getSupabaseServerClient()
  } else {
    const auth = await requireAdmin()
    if ('error' in auth) return auth.error
    supabase = auth.supabase
  }

  // Fetched once and reused for every product, rather than once per row.
  // If TCGdex is down or times out for this one call, that shouldn't take
  // out the whole run -- it just means non-override set names can't be
  // resolved for this pass, which is reported back per-product below
  // rather than as a single all-or-nothing failure.
  let englishSets: TcgdexSetSummary[] = []
  let setsListWarning: string | null = null
  try {
    englishSets = await fetchSetsList('en')
  } catch (err) {
    setsListWarning = `Could not load TCGdex's English sets list: ${err instanceof Error ? err.message : 'unknown error'}. Only SET_NAME_OVERRIDES entries could be resolved this run -- retry once TCGdex is reachable again.`
    console.error('[fetch-images]', setsListWarning)
  }
  const englishSetsByName = new Map(englishSets.map((s) => [normalizeSetName(s.name), s]))

  const { data: products, error } = await supabase
    .from('products')
    .select('id, title, category, set_name, card_number, images, release_date')
    .in('category', ['sealed', 'cards'])

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Set-detail lookups are per-set, not per-product — cache each set's full
  // detail (card list + logo) the first time it's needed, since many
  // products usually share the same set.
  const setDetailCache = new Map<string, TcgdexSetDetail | null>()
  async function getSetDetail(setId: string, lang: 'en' | 'ja') {
    const key = `${lang}:${setId}`
    if (!setDetailCache.has(key)) {
      setDetailCache.set(key, await fetchSetDetail(setId, lang))
    }
    return setDetailCache.get(key) ?? null
  }

  function resolveSet(setName: string): ResolvedSet | null {
    const override = SET_NAME_OVERRIDES[setName]
    if (override) return { id: override.setId, lang: override.lang }

    const matched = englishSetsByName.get(normalizeSetName(setName))
    if (!matched) return null
    return { id: matched.id, lang: 'en', logo: matched.logo }
  }

  type Result = { id: string; title: string; status: string }
  type CardMatch = { id: string; lang: 'en' | 'ja' }

  async function findCardInSet(setId: string, lang: 'en' | 'ja', candidates: string[]): Promise<CardMatch | null> {
    const setDetail = await getSetDetail(setId, lang)
    const card = setDetail?.cards?.find((c) => candidates.includes(c.localId))
    return card ? { id: card.id, lang } : null
  }

  type SafetyNetResult =
    | { kind: 'match'; match: CardMatch }
    | { kind: 'ambiguous'; count: number }
    | { kind: 'none' }

  /**
   * A common name (Charizard, Bulbasaur, ...) has been reprinted across
   * dozens of sets, and a local id is only unique *within* a set -- e.g.
   * "Charizard" local id 4 alone matches four completely unrelated prints
   * (ex14-4, base1-4, base5-4, base4-4). Without a resolved set_name to
   * narrow the search, picking whichever result happens to come back first
   * would silently save the wrong print just as easily as it saves the
   * right one -- exactly the failure mode the name-mismatch check above
   * exists to catch. So this only ever returns a match when name+local-id
   * narrows the whole search (both languages combined) down to one single
   * card id; anything else comes back 'ambiguous' and is reported for a
   * human to resolve rather than guessed at.
   */
  async function findCardBySafetyNet(product: ProductRow, candidates: string[]): Promise<SafetyNetResult> {
    const searchName = stripVariantTag(product.title)
    if (!searchName) return { kind: 'none' }

    const found: CardMatch[] = []
    for (const lang of ['en', 'ja'] as const) {
      const results = await searchCardsByName(searchName, lang)
      for (const r of results) {
        if (candidates.includes(r.localId)) found.push({ id: r.id, lang })
      }
    }

    const uniqueIds = Array.from(new Set(found.map((f) => f.id)))
    if (uniqueIds.length === 0) return { kind: 'none' }
    if (uniqueIds.length > 1) return { kind: 'ambiguous', count: uniqueIds.length }
    return { kind: 'match', match: found.find((f) => f.id === uniqueIds[0])! }
  }

  async function finalizeCardMatch(
    product: ProductRow,
    match: CardMatch,
    matchedVia: string,
    setContext: { id: string; lang: 'en' | 'ja' } | null,
  ): Promise<Result> {
    const cardDetail = await fetchCardDetail(match.id, match.lang)
    if (!cardDetail?.image) {
      return {
        id: product.id,
        title: product.title,
        status: `card matched (${match.id} via ${matchedVia}) but TCGdex has no image for it yet`,
      }
    }

    if (match.lang === 'en' && cardDetail.name && !namesLikelyMatch(product.title, cardDetail.name)) {
      // Collectr's card_number can be wrong even when the set is right --
      // e.g. Collectr lists "Patrat" as #151 in White Flare, but TCGdex has
      // #151 as something else and the real Patrat at #152. Before giving
      // up, search the same resolved set by name instead of number: if
      // exactly one other card in it actually has this product's name, use
      // that card's image instead of trusting Collectr's number. Only
      // possible when this match came from a specific set (not the global
      // safety net, which has no "same set" to search within) and only
      // trusted when the name search is itself unambiguous -- multiple
      // same-named cards in one set (promos, alt arts) means guessing again,
      // so that still falls through to NAME MISMATCH below.
      if (setContext) {
        const setDetail = await getSetDetail(setContext.id, setContext.lang)
        const nameMatches = (setDetail?.cards ?? []).filter(
          (c) => c.id !== match.id && c.name && namesLikelyMatch(product.title, c.name),
        )
        if (nameMatches.length === 1) {
          const corrected = nameMatches[0]
          const correctedDetail = await fetchCardDetail(corrected.id, setContext.lang)
          if (correctedDetail?.image) {
            const correctionNote = `card_number ${product.card_number} was wrong (TCGdex has that number as "${cardDetail.name}") — corrected via name match to ${corrected.id} within ${setContext.id}`
            if (product.images?.length) {
              return {
                id: product.id,
                title: product.title,
                status: `already has images (${correctionNote}, image not overwritten)`,
              }
            }
            const correctedUrl = `${correctedDetail.image}/high.png`
            await supabase.from('products').update({ images: [correctedUrl] }).eq('id', product.id)
            return { id: product.id, title: product.title, status: `EN card image saved — ${correctionNote}` }
          }
        }
      }

      return {
        id: product.id,
        title: product.title,
        status: `NAME MISMATCH — card_number ${product.card_number} matched via ${matchedVia} is TCGdex's "${cardDetail.name}", not "${product.title}" — check the card number, image not saved`,
      }
    }

    // Validated above (name check passed, or it's a Japanese match that
    // can't be checked) before this ever looks at whether an image was
    // already saved — so a product that already has one still gets
    // reported on, it just isn't overwritten.
    if (product.images?.length) {
      return {
        id: product.id,
        title: product.title,
        status:
          match.lang === 'ja'
            ? 'already has images (Japanese card, name not verified)'
            : 'already has images (name verified OK)',
      }
    }

    const imageUrl = `${cardDetail.image}/high.png`
    await supabase.from('products').update({ images: [imageUrl] }).eq('id', product.id)
    return {
      id: product.id,
      title: product.title,
      status:
        match.lang === 'ja'
          ? `JP card image saved via ${matchedVia} — name not verified (Japanese script, no automated comparison)`
          : `EN card image saved via ${matchedVia}`,
    }
  }

  async function processProduct(product: ProductRow): Promise<Result> {
    if (!product.set_name) {
      return { id: product.id, title: product.title, status: 'skipped — no set_name on record' }
    }

    try {
      const resolved = resolveSet(product.set_name)

      if (product.category === 'sealed') {
        if (!resolved) {
          return { id: product.id, title: product.title, status: `no TCGdex set matched "${product.set_name}"` }
        }
        // Sealed products are just a set-logo lookup with no per-card name
        // to compare against, and no card-search safety net applies to a
        // whole box rather than a single card — nothing analogous to the
        // cards' fallbacks below.
        //
        // Image and release_date are backfilled independently of each
        // other -- a product that already has its logo saved should still
        // pick up release_date the first time this runs after
        // 0020_add_product_release_date.sql, and vice versa, rather than
        // the image-present check skipping the whole product.
        const needsImage = !product.images?.length
        const needsReleaseDate = !product.release_date
        const notes: string[] = []
        const updates: { images?: string[]; release_date?: string } = {}

        if (!needsImage) {
          notes.push('already has images')
        } else {
          let logo = resolved.logo
          if (!logo) {
            const detail = await getSetDetail(resolved.id, resolved.lang)
            logo = detail?.logo
          }
          if (logo) {
            updates.images = [`${logo}.png`]
            notes.push('set logo saved')
          } else {
            notes.push('no TCGdex logo available')
          }
        }

        if (needsReleaseDate) {
          // getSetDetail is cached per set (see setDetailCache above), so
          // this is a free cache hit whenever the image branch above
          // already fetched the same set's detail this run.
          const detail = await getSetDetail(resolved.id, resolved.lang)
          if (detail?.releaseDate) {
            updates.release_date = detail.releaseDate
            notes.push('release date saved')
          } else {
            notes.push('no TCGdex release date available')
          }
        }

        if (Object.keys(updates).length > 0) {
          await supabase.from('products').update(updates).eq('id', product.id)
        }

        return { id: product.id, title: product.title, status: `set matched (${resolved.id}) — ${notes.join(', ')}` }
      }

      // category === 'cards'
      if (!product.card_number) {
        return { id: product.id, title: product.title, status: 'skipped — no card_number on record' }
      }

      const override = CARD_OVERRIDES[cardOverrideKey(product.set_name, product.card_number)]
      if (override) {
        const match: CardMatch = { id: `${override.setId}-${override.localId}`, lang: override.lang }
        return await finalizeCardMatch(product, match, 'manual card override', { id: override.setId, lang: override.lang })
      }

      const candidates = candidateLocalIds(product.card_number)

      // 1) The resolved set, in whichever language it resolved to.
      // 2) The same set id, in the *other* language — TCGdex sometimes
      //    carries the same set under both without SET_NAME_OVERRIDES
      //    knowing it, or a set-detail request can transiently fail in one
      //    language and succeed in the other.
      // 3) A global name search across TCGdex's whole card index, filtered
      //    to the matching local id — the safety net for a set_name that
      //    never resolved to any TCGdex set at all, or a set that resolved
      //    but genuinely doesn't have this local id under either language.
      let match: CardMatch | null = null
      let matchedVia = ''
      let setContext: { id: string; lang: 'en' | 'ja' } | null = null

      if (resolved) {
        match = await findCardInSet(resolved.id, resolved.lang, candidates)
        if (match) {
          matchedVia = `set ${resolved.id} (${resolved.lang})`
          setContext = { id: resolved.id, lang: match.lang }
        }

        if (!match) {
          const otherLang = resolved.lang === 'en' ? 'ja' : 'en'
          match = await findCardInSet(resolved.id, otherLang, candidates)
          if (match) {
            matchedVia = `set ${resolved.id} (${otherLang}, cross-language fallback)`
            setContext = { id: resolved.id, lang: match.lang }
          }
        }
      }

      if (!match) {
        const safetyNet = await findCardBySafetyNet(product, candidates)
        if (safetyNet.kind === 'ambiguous') {
          return {
            id: product.id,
            title: product.title,
            status: `AMBIGUOUS — name-search safety net found ${safetyNet.count} different cards named "${product.title}" with local id matching #${product.card_number}, and no set_name to tell them apart — image not saved, needs manual review`,
          }
        }
        if (safetyNet.kind === 'match') {
          match = safetyNet.match
          matchedVia = `name search (${match.lang}, no set match)`
          // No setContext -- the safety net found this card with no set
          // scoping at all, so there's no "same set" to search by name in.
        }
      }

      if (!match) {
        return {
          id: product.id,
          title: product.title,
          status: resolved
            ? `no matching card for #${product.card_number} in ${resolved.id} (tried en+ja, and a name-search safety net)`
            : `no TCGdex set matched "${product.set_name}", and the name-search safety net found nothing for #${product.card_number}`,
        }
      }

      return await finalizeCardMatch(product, match, matchedVia, setContext)
    } catch (err) {
      return {
        id: product.id,
        title: product.title,
        status: `error: ${err instanceof Error ? err.message : 'unknown'}`,
      }
    }
  }

  // Processed with limited concurrency, not one at a time: the name
  // validation means every `cards` product now needs its own live TCGdex
  // fetch (previously most were skipped instantly), and a fully sequential
  // pass over hundreds of products risks running long enough to hit
  // Vercel's serverless function execution time limit once this is
  // deployed, not just being slow to test locally.
  const CONCURRENCY = 8
  const productList = (products ?? []) as ProductRow[]
  const results: Result[] = []
  for (let i = 0; i < productList.length; i += CONCURRENCY) {
    const batch = productList.slice(i, i + CONCURRENCY)
    const batchResults = await Promise.all(batch.map(processProduct))
    results.push(...batchResults)
  }

  return NextResponse.json({
    processed: results.length,
    ...(setsListWarning ? { warning: setsListWarning } : {}),
    results,
  })
}
