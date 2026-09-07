export type ProductType = 'pokemon' | 'sports_card'

/** A sports card's own attribute -- distinct from ProductType, which is Pokemon vs. Sports Cards overall. */
export type CardVariant = 'rookie' | 'auto' | 'patch' | 'parallel' | 'base'

export const CARD_VARIANT_OPTIONS: { value: CardVariant; label: string }[] = [
  { value: 'rookie', label: 'Rookie' },
  { value: 'auto', label: 'Auto' },
  { value: 'patch', label: 'Patch' },
  { value: 'parallel', label: 'Parallel' },
  { value: 'base', label: 'Base' },
]
