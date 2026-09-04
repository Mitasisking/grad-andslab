import { NextResponse } from 'next/server'
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
  image?: string
}

/**
 * The set-detail endpoint's embedded `cards` array is a lightweight
 * summary (id/localId/name only) -- it never carries `image`, for any
 * card, in any set. The actual image lives on the individual card record,
 * which needs its own fetch. Matches the two-step pattern the legacy
 * dashboard's card search already used for exactly this reason.
 */
async function fetchCardImage(cardId: string, lang: 'en' | 'ja'): Promise<string | null> {
  const res = await fetch(`https://api.tcgdex.net/v2/${lang}/cards/${cardId}`)
  if (!res.ok) return null
  const detail = (await res.json()) as TcgdexCardDetail
  return detail.image ?? null
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
  const res = await fetch(`https://api.tcgdex.net/v2/${lang}/sets`)
  if (!res.ok) throw new Error(`TCGdex sets list request failed (${res.status})`)
  return (await res.json()) as TcgdexSetSummary[]
}

async function fetchSetDetail(setId: string, lang: 'en' | 'ja'): Promise<TcgdexSetDetail | null> {
  const res = await fetch(`https://api.tcgdex.net/v2/${lang}/sets/${setId}`)
  if (!res.ok) return null
  return (await res.json()) as TcgdexSetDetail
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
  let supabase
  if (process.env.NODE_ENV !== 'production') {
    supabase = getSupabaseServerClient()
  } else {
    const auth = await requireAdmin()
    if ('error' in auth) return auth.error
    supabase = auth.supabase
  }

  // Fetched once and reused for every product, rather than once per row.
  let englishSets: TcgdexSetSummary[]
  try {
    englishSets = await fetchSetsList('en')
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not reach TCGdex' },
      { status: 502 },
    )
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

  const results: { id: string; title: string; status: string }[] = []

  for (const product of (products ?? []) as ProductRow[]) {
    if (product.images?.length) {
      results.push({ id: product.id, title: product.title, status: 'skipped — already has images' })
      continue
    }
    if (!product.set_name) {
      results.push({ id: product.id, title: product.title, status: 'skipped — no set_name on record' })
      continue
    }

    try {
      const resolved = resolveSet(product.set_name)
      if (!resolved) {
        results.push({ id: product.id, title: product.title, status: `no TCGdex set matched "${product.set_name}"` })
        continue
      }

      if (product.category === 'sealed') {
        let logo = resolved.logo
        if (!logo) {
          const detail = await getSetDetail(resolved.id, resolved.lang)
          logo = detail?.logo
        }
        if (!logo) {
          results.push({
            id: product.id,
            title: product.title,
            status: `set matched (${resolved.id}) but TCGdex has no logo for it`,
          })
          continue
        }
        const logoUrl = `${logo}.png`
        await supabase.from('products').update({ images: [logoUrl] }).eq('id', product.id)
        results.push({ id: product.id, title: product.title, status: `set logo saved (${resolved.id})` })
        continue
      }

      // category === 'cards'
      if (!product.card_number) {
        results.push({ id: product.id, title: product.title, status: 'skipped — no card_number on record' })
        continue
      }

      const setDetail = await getSetDetail(resolved.id, resolved.lang)
      if (!setDetail?.cards) {
        results.push({
          id: product.id,
          title: product.title,
          status: `no ${resolved.lang} card list for set ${resolved.id}`,
        })
        continue
      }

      const candidates = candidateLocalIds(product.card_number)
      const card = setDetail.cards.find((c) => candidates.includes(c.localId))
      if (!card) {
        results.push({
          id: product.id,
          title: product.title,
          status: `no matching card for #${product.card_number} in ${resolved.id} (${resolved.lang})`,
        })
        continue
      }

      const image = await fetchCardImage(card.id, resolved.lang)
      if (!image) {
        results.push({
          id: product.id,
          title: product.title,
          status: `card matched (${card.id}) but TCGdex has no image for it yet`,
        })
        continue
      }

      const imageUrl = `${image}/high.png`
      await supabase.from('products').update({ images: [imageUrl] }).eq('id', product.id)
      results.push({
        id: product.id,
        title: product.title,
        status: `${resolved.lang === 'ja' ? 'JP' : 'EN'} card image saved`,
      })
    } catch (err) {
      results.push({
        id: product.id,
        title: product.title,
        status: `error: ${err instanceof Error ? err.message : 'unknown'}`,
      })
    }
  }

  return NextResponse.json({ processed: results.length, results })
}
