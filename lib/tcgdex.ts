export interface TcgdexCard {
  id: string
  name: string
  localId?: string
  image?: string
  /** Resolved from the cached sets index below, not returned by the list endpoint itself. */
  setName?: string
}

/**
 * Splits a query into its name portion and its trailing card-number token,
 * e.g. "Ninetales 38" -> { name: "Ninetales", number: "38" }, "038/165" ->
 * { name: "", number: "038" } (the "/set-size" suffix is dropped), and
 * "Charizard" -> { name: "Charizard", number: null }. Confirmed live: TCGdex's
 * `name` filter is a literal match against the card's actual name, so a
 * compound query like "Ninetales 38" or "Ninetales 038/165" always returns
 * zero results from `name=` alone -- the number has to be pulled out and
 * matched separately (see searchTcgdexCards).
 */
function splitNameAndNumber(query: string): { name: string; number: string | null } {
  const trimmed = query.trim()
  const match = trimmed.match(/^(.*?)\s*(\d+)(?:\/\d+)?$/)
  if (!match) return { name: trimmed, number: null }
  return { name: match[1].trim(), number: match[2] }
}

/** Strips a leading zero run so "038" and "38" compare equal ("0" itself is left alone). */
function normalizeCardNumber(value: string): string {
  return value.replace(/^0+(?=\d)/, '')
}

let setsIndexPromise: Promise<Map<string, string>> | null = null

/**
 * Lazily fetches and caches TCGdex's full sets list once per page load
 * (~35KB, one request -- https://api.tcgdex.net/v2/en/sets) mapping set
 * code to real set name. Exists so search results can be labeled with
 * their actual set ("Paradox Rift") instead of TCGdex's internal code
 * ("sv04") or nothing at all, without a per-card detail fetch for every
 * row in a dropdown of up to 30 results -- the list/search endpoint
 * itself returns no set information, confirmed live (a card result is
 * only ever `{id, localId, name, image}`).
 */
function getTcgdexSetsIndex(): Promise<Map<string, string>> {
  if (!setsIndexPromise) {
    setsIndexPromise = fetch('https://api.tcgdex.net/v2/en/sets')
      .then((res) => (res.ok ? res.json() : []))
      .then((sets: { id: string; name: string }[]) => new Map(sets.map((s) => [s.id, s.name])))
      .catch((err) => {
        console.error('Could not load TCGdex sets index', err)
        return new Map<string, string>()
      })
  }
  return setsIndexPromise
}

/**
 * A card's `id` is `${setCode}-${localId}` (e.g. "sv04.5-240" for localId
 * "240"), but set codes themselves can contain dashes/dots, so this strips
 * the known `-${localId}` suffix by length rather than splitting on "-" --
 * splitting would cut "sv04.5-240" at the wrong dash if the code itself
 * had one.
 */
function setCodeFromCardId(card: TcgdexCard): string | null {
  if (!card.localId) return null
  const suffix = `-${card.localId}`
  return card.id.endsWith(suffix) ? card.id.slice(0, -suffix.length) : null
}

/**
 * One TCGdex list request, with real error visibility: a non-2xx response
 * is logged with its status and body (not just silently treated as "no
 * results"), since a rate-limit or malformed-query response looks
 * identical to a genuine empty result set unless you log it.
 */
async function fetchCards(url: string): Promise<TcgdexCard[]> {
  const res = await fetch(url)
  if (!res.ok) {
    const bodyText = await res.text().catch(() => '<could not read response body>')
    console.error(`TCGdex request failed: ${res.status} ${res.statusText} — ${url} — ${bodyText}`)
    return []
  }
  const data = await res.json()
  return Array.isArray(data) ? (data as TcgdexCard[]) : []
}

/**
 * Global search across TCGdex's entire card index, in three shapes depending
 * on what the query contains:
 *
 * - Name + number ("Ninetales 38", "Mega Gengar ex 240/193"): TCGdex's
 *   `name` filter is a literal match, so it can never match a compound
 *   string like this (confirmed live: `name=Ninetales%2038` returns `[]`
 *   even though 63 real Ninetales cards exist). Fetching by the name alone
 *   and filtering the response to the requested number locally is what
 *   actually finds the card -- and is also what correctly disambiguates
 *   cards that share a collector number across sets (e.g. Mega Gengar ex
 *   and Tinkaton ex are both 240/193).
 * - Number only ("38", "038/165"): there's no name to search by, so this
 *   asks TCGdex for that `localId` directly. Verified against the live API
 *   rather than trusting the docs at face value: TCGdex's own filtering
 *   docs (https://tcgdex.dev/rest/filtering-sorting-pagination) document an
 *   `eq:` prefix for an exact-match filter (e.g. `localId=eq:120`), but that
 *   returned zero results in practice for every localId tested -- the bare
 *   substring form used here (`localId=120`) is what actually returns real
 *   results (81 cards for "120"); do not "fix" this to `eq:` without
 *   re-verifying against the live API first. `localId` also only ever holds
 *   the card's own number, never the "/set-size" suffix printed on the card
 *   ("240" not "240/193") -- confirmed live: `?localId=240` returns real
 *   matches, `?localId=240%2F193` returns `[]` every time, encoded or not --
 *   which is why splitNameAndNumber drops that suffix.
 * - Name only ("Charizard"): a plain `name=` search, unchanged from before.
 */
export async function searchTcgdexCards(query: string): Promise<TcgdexCard[]> {
  try {
    const { name, number } = splitNameAndNumber(query)
    if (!name && !number) return []

    let results: TcgdexCard[]
    if (name && number) {
      const nameMatches = await fetchCards(`https://api.tcgdex.net/v2/en/cards?name=${encodeURIComponent(name)}`)
      const target = normalizeCardNumber(number)
      results = nameMatches.filter((card) => card.localId && normalizeCardNumber(card.localId) === target)
    } else if (number) {
      results = await fetchCards(`https://api.tcgdex.net/v2/en/cards?localId=${encodeURIComponent(number)}`)
    } else {
      results = await fetchCards(`https://api.tcgdex.net/v2/en/cards?name=${encodeURIComponent(name)}`)
    }
    results = results.slice(0, 30)

    const setsIndex = await getTcgdexSetsIndex()
    for (const card of results) {
      const code = setCodeFromCardId(card)
      if (code) card.setName = setsIndex.get(code)
    }

    return results
  } catch (err) {
    console.error(`TCGdex card search failed for query "${query}":`, err)
    return []
  }
}

export const TCGDEX_UNSPECIFIED_SET = 'Not specified'

/** Full card detail (not returned by the search-list endpoint above) is where TCGdex's real set name lives. */
export async function fetchTcgdexSetName(cardId: string): Promise<string> {
  try {
    const res = await fetch(`https://api.tcgdex.net/v2/en/cards/${cardId}`)
    if (!res.ok) return TCGDEX_UNSPECIFIED_SET
    const detail = (await res.json()) as { set?: { name?: string } }
    return detail.set?.name?.trim() || TCGDEX_UNSPECIFIED_SET
  } catch (err) {
    console.error('Could not resolve TCGdex set name for', cardId, err)
    return TCGDEX_UNSPECIFIED_SET
  }
}
