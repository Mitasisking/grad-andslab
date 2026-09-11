export interface CardPricePoint {
  cardName: string
  setName: string
  rawEstimate: number
  gradedEstimate: number
}

export interface MarketPricingResult {
  language: 'english' | 'japanese'
  points: CardPricePoint[]
  /**
   * True until a real provider is wired into the fetcher that produced
   * this result -- see lib/market-trends/english-pricing.ts and
   * japanese-pricing.ts's own header comments. Load-bearing:
   * app/api/cron/market-trends/route.ts refuses to persist LLM output
   * computed over placeholder data, specifically to keep the
   * market_trends table (and the /admin/trends dashboard reading it) from
   * ever presenting fabricated numbers as real "buy raw & grade" advice.
   */
  isPlaceholder: boolean
}
