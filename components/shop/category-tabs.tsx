import Link from 'next/link'
import { buildShopUrl, type ShopUrlParams } from '@/lib/shop/shop-url'

// 'pokemon-center' is not a real products.category value (a Pokémon Center
// exclusive can be sealed, cards, whatever its real category is) -- it's a
// sentinel app/shop/page.tsx recognizes to switch into an entirely
// different query (is_pokemon_center = true, ignoring category and the
// Sealed time-gate), same reason productType's 'sports_card' is a URL
// param rather than a products.category value.
export const POKEMON_CENTER_CATEGORY = 'pokemon-center'

const CATEGORIES: { value: string | null; label: string }[] = [
  { value: null, label: 'All' },
  { value: 'graded', label: 'Graded' },
  { value: 'cards', label: 'Raw Cards' },
  { value: POKEMON_CENTER_CATEGORY, label: 'Pokémon Center' },
  { value: 'sealed', label: 'Sealed' },
  { value: 'accessories', label: 'Accessories' },
]

interface Props {
  active: string | null
  /** The full current param set, so switching tabs doesn't drop the product-type toggle or sports-card filters. */
  current: ShopUrlParams
}

/** URL-driven filter (?category=), not client state — matches how app/shop/page.tsx fetches server-side. */
export function CategoryTabs({ active, current }: Props) {
  return (
    <div
      className="inline-flex flex-wrap justify-center border rounded-full p-1 gap-1"
      style={{ borderColor: 'var(--line)', background: 'var(--paper-raised)' }}
    >
      {CATEGORIES.map((c) => {
        const selected = active === c.value
        return (
          <Link
            key={c.label}
            href={buildShopUrl(current, { category: c.value })}
            aria-current={selected ? 'page' : undefined}
            className="px-3.5 py-1.5 text-[13.5px] rounded-full transition-colors duration-200"
            style={{
              background: selected ? 'var(--seal)' : 'transparent',
              color: selected ? 'var(--seal-ink)' : 'var(--ink-muted)',
            }}
          >
            {c.label}
          </Link>
        )
      })}
    </div>
  )
}
