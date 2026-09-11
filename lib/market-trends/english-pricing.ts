import type { MarketPricingResult } from './types'

/**
 * STUB — not wired to a real provider yet.
 *
 * Intended real source: daily TCGplayer market prices for recent English
 * sets, via a provider like PokemonPriceTracker's API (or a similar
 * TCGplayer aggregator). No verified API documentation (endpoint paths,
 * auth scheme, response shape) was available to build against when this
 * was written, and guessing at a third-party API's contract produces code
 * that looks complete while being silently wrong — the same reasoning
 * app/api/pricing/route.ts's own header comment already gives for why
 * *that* route still returns a pseudo-estimate instead of a real
 * TCGplayer/PriceCharting call.
 *
 * To wire up the real thing: replace the body below with an actual
 * fetch() against the provider's documented endpoint, reading credentials
 * from an env var (e.g. POKEMON_PRICE_TRACKER_API_KEY — match whatever the
 * real provider actually calls it), and set isPlaceholder to false.
 * Nothing else needs to change — app/api/cron/market-trends/route.ts
 * already reads isPlaceholder to decide whether the Analyst's output is
 * safe to persist.
 */
export async function fetchEnglishMarketData(): Promise<MarketPricingResult> {
  return {
    language: 'english',
    points: [],
    isPlaceholder: true,
  }
}
