import type { MarketPricingResult } from './types'

/**
 * STUB — not wired to a real provider yet.
 *
 * Intended real source: Japanese card prices via either this app's
 * existing PriceCharting relationship (see app/api/pricing/route.ts —
 * itself still a placeholder today, not a live PriceCharting call) or the
 * Japanese-market endpoints of the same PokemonPriceTracker API the
 * English fetcher (english-pricing.ts) would use, focused on
 * Japanese-exclusive sets and promos. Same reasoning as that file: no
 * verified API documentation was available to build against, so this
 * stays a stub rather than a guess at a third-party contract.
 *
 * To wire up the real thing: replace the body below with an actual
 * fetch() against the provider's documented endpoint, reading credentials
 * from an env var (e.g. PRICECHARTING_API_KEY, already referenced in
 * app/api/pricing/route.ts's own comment as the eventual real key), and
 * set isPlaceholder to false.
 */
export async function fetchJapaneseMarketData(): Promise<MarketPricingResult> {
  return {
    language: 'japanese',
    points: [],
    isPlaceholder: true,
  }
}
