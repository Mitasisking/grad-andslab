export interface MarketValueResult {
  estimate: number
  source: string
}

export async function fetchMarketValue(cardName: string, setName: string): Promise<MarketValueResult | null> {
  const params = new URLSearchParams({ cardName, setName })
  const res = await fetch(`/api/pricing?${params.toString()}`)
  if (!res.ok) return null
  const data = await res.json()
  return { estimate: data.estimate, source: data.source }
}
