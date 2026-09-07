import Link from 'next/link'
import { buildShopUrl, type ShopUrlParams } from '@/lib/shop/shop-url'
import type { ProductType } from '@/lib/shop/product-type'

const TYPES: { value: ProductType; label: string }[] = [
  { value: 'pokemon', label: 'Pokémon' },
  { value: 'sports_card', label: 'Sports Cards' },
]

interface Props {
  active: ProductType
  current: ShopUrlParams
}

/**
 * Master toggle above the category tabs. Switching product type drops the
 * sports-card sidebar filters (sport/brand/card variant/player) since
 * they're meaningless for the other type, but keeps the current category
 * tab -- that facet applies to both.
 */
export function ProductTypeToggle({ active, current }: Props) {
  return (
    <div
      className="inline-flex border rounded-[3px] p-1 gap-1"
      style={{ borderColor: 'var(--line)', background: 'var(--paper-raised)' }}
    >
      {TYPES.map((t) => {
        const selected = active === t.value
        return (
          <Link
            key={t.value}
            href={buildShopUrl(current, {
              productType: t.value === 'pokemon' ? null : t.value,
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
            {t.label}
          </Link>
        )
      })}
    </div>
  )
}
