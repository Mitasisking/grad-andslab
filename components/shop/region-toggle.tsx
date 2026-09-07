import Link from 'next/link'
import { buildShopUrl, type ShopUrlParams } from '@/lib/shop/shop-url'
import { REGION_OPTIONS, type ProductRegion } from '@/lib/shop/product-type'

interface Props {
  active: ProductRegion
  current: ShopUrlParams
}

/**
 * Which storefront a visitor is browsing -- each product belongs to exactly
 * one region (0031_add_product_region.sql) and is priced in that region's
 * currency with no conversion, so the grid has to be scoped to one region
 * at a time rather than mixing USD/GBP/ZAR listings together. Switching
 * region drops the sport/brand/card-variant/player facets the same way
 * ProductTypeToggle drops them on a product-type switch -- the available
 * options are a completely different set of products now.
 */
export function RegionToggle({ active, current }: Props) {
  return (
    <div
      className="inline-flex border rounded-[3px] p-1 gap-1"
      style={{ borderColor: 'var(--line)', background: 'var(--paper-raised)' }}
    >
      {REGION_OPTIONS.map((r) => {
        const selected = active === r.value
        return (
          <Link
            key={r.value}
            href={buildShopUrl(current, {
              region: r.value === 'sa' ? null : r.value,
              sport: [],
              brand: [],
              cardVariant: [],
              player: null,
            })}
            className="px-4 py-1.5 text-[13.5px] rounded-[3px]"
            style={{
              background: selected ? 'var(--seal)' : 'transparent',
              color: selected ? 'var(--seal-ink)' : 'var(--ink-muted)',
            }}
          >
            {r.label}
          </Link>
        )
      })}
    </div>
  )
}
