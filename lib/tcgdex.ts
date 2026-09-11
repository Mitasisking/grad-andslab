export interface TcgdexCard {
  id: string
  name: string
  localId?: string
  image?: string
}

function hasDigit(value: string): boolean {
  return /\d/.test(value)
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
 * Global search across TCGdex's entire card index. Searches by `name`
 * always, and ALSO by card number (TCGdex's `localId` field) whenever the
 * query contains a digit -- the actual fix for a previously-reported "typing
 * 120 shows Card not found" bug: a `name=` search can never match a purely
 * numeric query, so TCGdex was correctly returning a genuine empty array,
 * not failing.
 *
 * Verified directly against the live API rather than trusting the docs at
 * face value: TCGdex's own filtering docs (https://tcgdex.dev/rest/
 * filtering-sorting-pagination) document an `eq:` prefix for an exact-match
 * filter (e.g. `localId=eq:120`), but that returned zero results in
 * practice for every localId tested. The bare substring form already used
 * for `name` -- `localId=120` -- is what actually returns real results (81
 * cards for "120"), so that's what this uses; do not "fix" this to `eq:`
 * without re-verifying against the live API first.
 *
 * `localId` only ever holds the card's own number, never the "/set-size"
 * suffix printed on the card ("240" not "240/193") -- confirmed live:
 * `?localId=240` returns real matches, `?localId=240%2F193` returns `[]`
 * every time, encoded or not. So a query like "240/193" is split on the
 * first `/` for the localId lookup only; the `name=` search still gets the
 * untouched original query, since a card's actual name is never expected to
 * contain that suffix and there's no reason to touch it.
 */
export async function searchTcgdexCards(query: string): Promise<TcgdexCard[]> {
  try {
    const localId = query.split('/')[0].trim()
    const requests = [fetchCards(`https://api.tcgdex.net/v2/en/cards?name=${encodeURIComponent(query)}`)]
    if (hasDigit(localId)) {
      requests.push(fetchCards(`https://api.tcgdex.net/v2/en/cards?localId=${encodeURIComponent(localId)}`))
    }
    const resultSets = await Promise.all(requests)
    const merged = new Map<string, TcgdexCard>()
    for (const set of resultSets) {
      for (const card of set) {
        if (!merged.has(card.id)) merged.set(card.id, card)
      }
    }
    return Array.from(merged.values()).slice(0, 30)
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
