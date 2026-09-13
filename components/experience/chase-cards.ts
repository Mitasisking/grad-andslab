export interface ChaseCard {
  name: string
  /** TCGdex card id (`${setCode}-${localId}`) -- kept for provenance/debugging, not read at render time. */
  tcgdexId: string
  /** High-res front artwork, `https://assets.tcgdex.net/{lang}/{series}/{set}/{localId}/high.png`. */
  image: string
  /** Fan layout in local units, applied before the shared group scale/tilt. */
  fanX: number
  fanZ: number
  fanRotationZ: number
}

/**
 * The three chase cards for the hero shatter fan, confirmed live against the
 * TCGdex API (https://api.tcgdex.net/v2/en/cards?name=...) rather than
 * guessed -- each `tcgdexId`/`image` pair below matches the set's real
 * "official" print count too (e.g. Paldean Fates' 232/091: TCGdex reports
 * sv04.5's `cardCount.official` as 91, so "232" is a secret rare beyond the
 * base 91-card run, not a typo).
 */
export const CHASE_CARDS: ChaseCard[] = [
  {
    name: 'Mew ex',
    tcgdexId: 'sv04.5-232',
    image: 'https://assets.tcgdex.net/en/sv/sv04.5/232/high.png',
    fanX: -0.95,
    fanZ: -0.1,
    fanRotationZ: 0.34,
  },
  {
    name: 'Pikachu ex',
    tcgdexId: 'me02.5-277',
    image: 'https://assets.tcgdex.net/en/me/me02.5/277/high.png',
    fanX: 0,
    fanZ: 0.12,
    fanRotationZ: 0,
  },
  {
    name: 'Mega Gengar ex',
    tcgdexId: 'me02.5-284',
    image: 'https://assets.tcgdex.net/en/me/me02.5/284/high.png',
    fanX: 0.95,
    fanZ: -0.1,
    fanRotationZ: -0.34,
  },
]
