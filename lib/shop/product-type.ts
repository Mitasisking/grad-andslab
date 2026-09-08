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

/**
 * A flat percentage of the charge, stamped onto an order/submission at
 * checkout as a bookkeeping figure (see app/api/submissions/route.ts and
 * 0034_accounting_foundations.sql's create_order()) -- it does not change
 * what a customer is actually charged, no tax line item is added anywhere
 * this is used. Placeholder baseline rates per the business's own
 * instruction (20% UK, 15% SA, 0% USA); replace with real
 * jurisdiction-correct rates before this becomes an actual tax filing.
 */
export const REGION_TAX_RATE: Record<ProductRegion, number> = {
  sa: 0.15,
  uk: 0.2,
  usa: 0,
}

/**
 * Static, hardcoded ZAR conversion rate -- explicitly a placeholder per the
 * business's own instruction, to be swapped for a live FX API later. 1 unit
 * of the region's own currency converts to this many ZAR -- the accounting
 * ledger's reporting baseline (0034_accounting_foundations.sql's
 * ledger_currency, constrained to 'zar'). South Africa's own rate is 1
 * (already ZAR, nothing to convert). USA and UK route through the same
 * approximate USD/GBP/ZAR relationship already used for grading-tier
 * pricing (lib/submission-types.ts's own basePriceGBP/basePriceZAR
 * comment): 0.79 USD/GBP, 18.5 USD/ZAR.
 */
export const REGION_EXCHANGE_RATE_TO_ZAR: Record<ProductRegion, number> = {
  sa: 1,
  usa: 18.5,
  uk: 18.5 / 0.79,
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
