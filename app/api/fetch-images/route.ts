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
 * "Raging Surf" and "Shiny Treasure ex" both used to be unresolved: TCGdex's
 * own `name` field mislabels SV4a with the same Japanese name as SV3a
 * ("レイジングサーフ" for both), which is why they looked like one name
 * shared by two ids. Resolved by checking card contents instead of the set
 * name: SV3a is the real Raging Surf (92 cards, no secret-rare tail); SV4a's
 * highest local ids are Koraidon ex / Miraidon ex / the Treasures of Ruin ex
 * cards as secret rares -- the signature chase cards of Shiny Treasure ex,
 * whose 320-card total (190 official + a ~130-card shiny-vault tail) is
 * unlike anything else in this generation.
 *
 * Still-unresolved gaps, not guessed at:
 *   - "Triplet Beat": SIXTEEN different ids share this name
 *     (トリプレットビート) -- almost certainly different box/deck
 *     variants under one set name, and unlike Raging Surf/Shiny Treasure ex
 *     there's no card-content signal yet to tell them apart.
 *   - "Nihil Zero", "The Pokedex": no confident match found in the Japanese
 *     sets list at all.
 * None of these three are in this table -- they'll still report
 * "no TCGdex set matched" until someone identifies the right id.
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
}

interface TcgdexSetDetail {
  logo?: string
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

/**
 * The set-detail endpoint's embedded `cards` array is a lightweight
 * summary (id/localId/name only) -- it never carries `image`, for any
 * card, in any set. The actual image lives on the individual card record,
 * which needs its own fetch. Matches the two-step pattern the legacy
 * dashboard's card search already used for exactly this reason.
 *
 * Network failures and timeouts are caught and logged here rather than
 * left to bubble up -- TCGdex being briefly down or slow for one card
 * should degrade to "no image for this product yet", not take out the
 * whole batch it's part of.
 */
async function fetchCardDetail(cardId: string, lang: 'en' | 'ja'): Promise<TcgdexCardDetail | null> {
  try {
    const res = await fetchWithTimeout(`https://api.tcgdex.net/v2/${lang}/cards/${cardId}`)
    if (!res.ok) return null
    return (await res.json()) as TcgdexCardDetail
  } catch (err) {
    console.error(`[fetch-images] card detail request failed for ${lang}/${cardId}:`, err instanceof Error ? err.message : err)
    return null
  }
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
    .select('id, title, category, set_name, card_number, images')
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

  async function finalizeCardMatch(product: ProductRow, match: CardMatch, matchedVia: string): Promise<Result> {
    const cardDetail = await fetchCardDetail(match.id, match.lang)
    if (!cardDetail?.image) {
      return {
        id: product.id,
        title: product.title,
        status: `card matched (${match.id} via ${matchedVia}) but TCGdex has no image for it yet`,
      }
    }

    if (match.lang === 'en' && cardDetail.name && !namesLikelyMatch(product.title, cardDetail.name)) {
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
        if (product.images?.length) {
          return { id: product.id, title: product.title, status: 'skipped — already has images' }
        }
        let logo = resolved.logo
        if (!logo) {
          const detail = await getSetDetail(resolved.id, resolved.lang)
          logo = detail?.logo
        }
        if (!logo) {
          return {
            id: product.id,
            title: product.title,
            status: `set matched (${resolved.id}) but TCGdex has no logo for it`,
          }
        }
        const logoUrl = `${logo}.png`
        await supabase.from('products').update({ images: [logoUrl] }).eq('id', product.id)
        return { id: product.id, title: product.title, status: `set logo saved (${resolved.id})` }
      }

      // category === 'cards'
      if (!product.card_number) {
        return { id: product.id, title: product.title, status: 'skipped — no card_number on record' }
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

      if (resolved) {
        match = await findCardInSet(resolved.id, resolved.lang, candidates)
        if (match) matchedVia = `set ${resolved.id} (${resolved.lang})`

        if (!match) {
          const otherLang = resolved.lang === 'en' ? 'ja' : 'en'
          match = await findCardInSet(resolved.id, otherLang, candidates)
          if (match) matchedVia = `set ${resolved.id} (${otherLang}, cross-language fallback)`
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

      return await finalizeCardMatch(product, match, matchedVia)
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
