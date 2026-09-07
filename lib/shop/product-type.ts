export type ProductType = 'pokemon' | 'sports_card'

/** Which storefront region a product's stock/price belongs to -- see 0031_add_product_region.sql. */
export type ProductRegion = 'usa' | 'uk' | 'sa'

export const REGION_OPTIONS: { value: ProductRegion; label: string }[] = [
  { value: 'sa', label: 'South Africa' },
  { value: 'usa', label: 'USA' },
  { value: 'uk', label: 'UK' },
]

/** products.price is always denominated in the currency of its own region -- never converted. */
export const REGION_CURRENCY: Record<ProductRegion, 'zar' | 'usd' | 'gbp'> = {
  sa: 'zar',
  usa: 'usd',
  uk: 'gbp',
}

export const REGION_SYMBOL: Record<ProductRegion, string> = {
  sa: 'R',
  usa: '$',
  uk: '£',
}

/** A sports card's own attribute -- distinct from ProductType, which is Pokemon vs. Sports Cards overall. */
export type CardVariant = 'rookie' | 'auto' | 'patch' | 'parallel' | 'base'

export const CARD_VARIANT_OPTIONS: { value: CardVariant; label: string }[] = [
  { value: 'rookie', label: 'Rookie' },
  { value: 'auto', label: 'Auto' },
  { value: 'patch', label: 'Patch' },
  { value: 'parallel', label: 'Parallel' },
  { value: 'base', label: 'Base' },
]
