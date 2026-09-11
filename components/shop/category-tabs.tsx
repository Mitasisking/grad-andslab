import Link from 'next/link'
import { buildShopUrl, type ShopUrlParams } from '@/lib/shop/shop-url'

const CATEGORIES: { value: string | null; label: string }[] = [
  { value: null, label: 'All' },
  { value: 'graded', label: 'Graded' },
  { value: 'cards', label: 'Raw Cards' },
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
