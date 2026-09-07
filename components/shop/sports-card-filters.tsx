import Link from 'next/link'
import { buildShopUrl, type ShopUrlParams } from '@/lib/shop/shop-url'
import { SPORT_OPTIONS, type Sport } from '@/lib/submission-types'
import { CARD_VARIANT_OPTIONS, type CardVariant } from '@/lib/shop/product-type'
import type { Product } from './product-grid'

function toggled<T extends string>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

const OPTION_ROW = 'flex items-center gap-2 text-[13.5px] py-1'

interface Props {
  /** Brand options are derived from this list, so it must be the type+category-filtered set only — not the fully-filtered grid results, or selecting one facet would collapse the others' checkbox lists to whatever that selection still matches (same trap components/shop/product-filters.tsx's Set/Language filters already avoid). See app/shop/page.tsx's baseProducts vs. products split. */
  facetSourceProducts: Product[]
  current: ShopUrlParams
}

/** Sports-card sidebar — server-rendered Links/form, no client state, same convention as CategoryTabs and ProductTypeToggle. Swapped in for components/shop/product-filters.tsx when the Sports Cards toggle is active. */
export function SportsCardFilters({ facetSourceProducts, current }: Props) {
  const brands = Array.from(
    new Set(facetSourceProducts.map((p) => p.brand).filter((b): b is string => !!b)),
  ).sort((a, b) => a.localeCompare(b))

  const selectedSports = (current.sport ?? []) as Sport[]
  const selectedBrands = current.brand ?? []
  const selectedVariants = (current.cardVariant ?? []) as CardVariant[]

  const hasActiveFilters =
    selectedSports.length > 0 || selectedBrands.length > 0 || selectedVariants.length > 0 || !!current.player

  return (
    <div className="w-full lg:w-56 shrink-0">
      <div className="flex items-center justify-between">
        <h2 className="text-[13.5px] uppercase tracking-wide" style={{ color: 'var(--ink-muted)' }}>
          Filters
        </h2>
        {hasActiveFilters && (
          <Link
            href={buildShopUrl(current, { sport: [], brand: [], cardVariant: [], player: null })}
            className="text-[12.5px] underline underline-offset-2"
            style={{ color: 'var(--ink-muted)' }}
          >
            Clear
          </Link>
        )}
      </div>

      <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--line)' }}>
        <p className="text-[12.5px] mb-1.5" style={{ color: 'var(--ink)' }}>
          Player Name
        </p>
        <form action="/shop" method="GET">
          {current.category && <input type="hidden" name="category" value={current.category} />}
          <input type="hidden" name="productType" value="sports_card" />
          {selectedSports.length > 0 && <input type="hidden" name="sport" value={selectedSports.join(',')} />}
          {selectedBrands.length > 0 && <input type="hidden" name="brand" value={selectedBrands.join(',')} />}
          {selectedVariants.length > 0 && (
            <input type="hidden" name="cardVariant" value={selectedVariants.join(',')} />
          )}
          <input
            type="text"
            name="player"
            defaultValue={current.player ?? ''}
            placeholder="Search player…"
            className="w-full border rounded-[3px] px-2 py-1.5 text-[13px] bg-transparent"
            style={{ borderColor: 'var(--line)', color: 'var(--ink)' }}
          />
        </form>
      </div>

      <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--line)' }}>
        <p className="text-[12.5px] mb-1.5" style={{ color: 'var(--ink)' }}>
          Sport
        </p>
        {SPORT_OPTIONS.map((s) => {
          const isSelected = selectedSports.includes(s.value)
          return (
            <Link
              key={s.value}
              href={buildShopUrl(current, { sport: toggled(selectedSports, s.value) })}
              className={OPTION_ROW}
              style={{ color: 'var(--ink)' }}
            >
              <span
                className="w-3.5 h-3.5 border rounded-[2px] inline-block shrink-0"
                style={{ borderColor: 'var(--line)', background: isSelected ? 'var(--seal)' : 'transparent' }}
              />
              {s.label}
            </Link>
          )
        })}
      </div>

      <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--line)' }}>
        <p className="text-[12.5px] mb-1.5" style={{ color: 'var(--ink)' }}>
          Card Type
        </p>
        {CARD_VARIANT_OPTIONS.map((v) => {
          const isSelected = selectedVariants.includes(v.value)
          return (
            <Link
              key={v.value}
              href={buildShopUrl(current, { cardVariant: toggled(selectedVariants, v.value) })}
              className={OPTION_ROW}
              style={{ color: 'var(--ink)' }}
            >
              <span
                className="w-3.5 h-3.5 border rounded-[2px] inline-block shrink-0"
                style={{ borderColor: 'var(--line)', background: isSelected ? 'var(--seal)' : 'transparent' }}
              />
              {v.label}
            </Link>
          )
        })}
      </div>

      {brands.length > 0 && (
        <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--line)' }}>
          <p className="text-[12.5px] mb-1.5" style={{ color: 'var(--ink)' }}>
            Brand
          </p>
          {brands.map((b) => {
            const isSelected = selectedBrands.includes(b)
            return (
              <Link
                key={b}
                href={buildShopUrl(current, { brand: toggled(selectedBrands, b) })}
                className={OPTION_ROW}
                style={{ color: 'var(--ink)' }}
              >
                <span
                  className="w-3.5 h-3.5 border rounded-[2px] inline-block shrink-0"
                  style={{ borderColor: 'var(--line)', background: isSelected ? 'var(--seal)' : 'transparent' }}
                />
                {b}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
