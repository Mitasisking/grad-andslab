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
 * - category = 'cards': matches products.set_name the same way, then
 *   looks up the specific card by local number within that set — in
 *   Japanese if the title is tagged "(JP)", English otherwise.
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
 * set_name against automatically. These ~20 entries were matched by hand
 * (phonetic transliteration, e.g. メガドリームex -> "MEGA Dream ex"), not
 * fetched from anywhere authoritative, so verify them if a wrong image
 * shows up. Known gaps, not guessed at:
 *   - "Raging Surf": two different TCGdex ids (SV4a, SV3a) share this
 *     exact Japanese name (レイジングサーフ) -- which one is actually
 *     yours needs a human decision, not a coin flip.
 *   - "Triplet Beat": SIXTEEN different ids share this name
 *     (トリプレットビート) -- almost certainly different box/deck
 *     variants under one set name. Same issue, worse.
 *   - "Nihil Zero", "The Pokedex", "Shiny Treasure ex": no confident match
 *     found in the Japanese sets list at all.
 * None of the four above are in this table -- they'll still report
 * "no TCGdex set matched" until you add them once you know the right id.
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
}

const FLUFF_WORDS = ['booster box', 'booster bundle', 'booster pack', 'elite trainer box', 'bundle', 'box', 'pack']

function normalizeSetName(name: string): string {
  let normalized = name.toLowerCase()
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

  async function processProduct(product: ProductRow): Promise<Result> {
    if (!product.set_name) {
      return { id: product.id, title: product.title, status: 'skipped — no set_name on record' }
    }

    try {
      const resolved = resolveSet(product.set_name)
      if (!resolved) {
        return { id: product.id, title: product.title, status: `no TCGdex set matched "${product.set_name}"` }
      }

      if (product.category === 'sealed') {
        // Sealed products are just a set-logo lookup with no per-card name
        // to compare against — nothing analogous to the cards' mismatch
        // check below applies, so skipping when already saved is safe here.
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

      const setDetail = await getSetDetail(resolved.id, resolved.lang)
      if (!setDetail?.cards) {
        return {
          id: product.id,
          title: product.title,
          status: `no ${resolved.lang} card list for set ${resolved.id}`,
        }
      }

      const candidates = candidateLocalIds(product.card_number)
      const card = setDetail.cards.find((c) => candidates.includes(c.localId))
      if (!card) {
        return {
          id: product.id,
          title: product.title,
          status: `no matching card for #${product.card_number} in ${resolved.id} (${resolved.lang})`,
        }
      }

      const cardDetail = await fetchCardDetail(card.id, resolved.lang)
      if (!cardDetail?.image) {
        return {
          id: product.id,
          title: product.title,
          status: `card matched (${card.id}) but TCGdex has no image for it yet`,
        }
      }

      if (resolved.lang === 'en' && cardDetail.name && !namesLikelyMatch(product.title, cardDetail.name)) {
        return {
          id: product.id,
          title: product.title,
          status: `NAME MISMATCH — card_number ${product.card_number} in ${resolved.id} is TCGdex's "${cardDetail.name}", not "${product.title}" — check the card number, image not saved`,
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
            resolved.lang === 'ja'
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
          resolved.lang === 'ja'
            ? 'JP card image saved — name not verified (Japanese script, no automated comparison)'
            : 'EN card image saved',
      }
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
