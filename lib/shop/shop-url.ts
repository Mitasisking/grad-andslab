/**
 * Every shop filter (category tabs, the Pokemon/Sports Cards toggle, and
 * the sports-card sidebar facets) is a plain server-rendered Link, not
 * client state -- same convention components/shop/category-tabs.tsx
 * already used before this. Each of those components only knows about the
 * one param it changes, so this is the one place that merges a partial
 * change into the *current* full param set, otherwise clicking e.g. a
 * category tab while a sport filter is active would silently drop the
 * sport filter (each component would only ever know how to set its own
 * param, not preserve the others).
 */
export interface ShopUrlParams {
  category?: string | null
  productType?: string | null
  sport?: string[]
  brand?: string[]
  cardVariant?: string[]
  player?: string | null
}

export function buildShopUrl(current: ShopUrlParams, changes: Partial<ShopUrlParams>): string {
  const merged: ShopUrlParams = { ...current, ...changes }
  const params = new URLSearchParams()

  if (merged.category) params.set('category', merged.category)
  if (merged.productType) params.set('productType', merged.productType)
  if (merged.sport?.length) params.set('sport', merged.sport.join(','))
  if (merged.brand?.length) params.set('brand', merged.brand.join(','))
  if (merged.cardVariant?.length) params.set('cardVariant', merged.cardVariant.join(','))
  if (merged.player?.trim()) params.set('player', merged.player.trim())

  const qs = params.toString()
  return qs ? `/shop?${qs}` : '/shop'
}
