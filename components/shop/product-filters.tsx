'use client'

import type { Product } from './product-grid'

export type Language = 'en' | 'jp'

export interface ShopFilterState {
  languages: Language[]
  setNames: string[]
  minPrice: string
  maxPrice: string
}

export const EMPTY_FILTERS: ShopFilterState = { languages: [], setNames: [], minPrice: '', maxPrice: '' }

/** Collectr tags every Japanese listing's title with this suffix — the one signal available, per app/api/fetch-images/route.ts's own JP-detection logic. */
export function isJapanese(title: string): boolean {
  return title.includes('(JP)')
}

export function applyShopFilters(products: Product[], filters: ShopFilterState): Product[] {
  const min = filters.minPrice.trim() ? Number(filters.minPrice) : null
  const max = filters.maxPrice.trim() ? Number(filters.maxPrice) : null

  return products.filter((p) => {
    if (filters.languages.length > 0) {
      const lang: Language = isJapanese(p.title) ? 'jp' : 'en'
      if (!filters.languages.includes(lang)) return false
    }
    if (filters.setNames.length > 0 && !(p.set_name && filters.setNames.includes(p.set_name))) return false
    if (min !== null && !Number.isNaN(min) && p.price < min) return false
    if (max !== null && !Number.isNaN(max) && p.price > max) return false
    return true
  })
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

interface Props {
  products: Product[]
  filters: ShopFilterState
  onChange: (filters: ShopFilterState) => void
}

const CHECKBOX_LABEL = 'flex items-center gap-2 text-[13.5px] py-1 cursor-pointer'

/** Sidebar filters for the shop grid — set/language facets are derived from whatever products the current category tab loaded, so they never offer a set or language that has zero matches. */
export function ProductFilters({ products, filters, onChange }: Props) {
  const setNames = Array.from(new Set(products.map((p) => p.set_name).filter((s): s is string => !!s))).sort((a, b) =>
    a.localeCompare(b),
  )

  const hasActiveFilters =
    filters.languages.length > 0 || filters.setNames.length > 0 || filters.minPrice !== '' || filters.maxPrice !== ''

  return (
    <div className="w-full lg:w-56 shrink-0">
      <div className="flex items-center justify-between">
        <h2 className="text-[13.5px] uppercase tracking-wide" style={{ color: 'var(--ink-muted)' }}>
          Filters
        </h2>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => onChange(EMPTY_FILTERS)}
            className="text-[12.5px] underline underline-offset-2"
            style={{ color: 'var(--ink-muted)' }}
          >
            Clear
          </button>
        )}
      </div>

      <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--line)' }}>
        <p className="text-[12.5px] mb-1.5" style={{ color: 'var(--ink)' }}>
          Language
        </p>
        {(['en', 'jp'] as Language[]).map((lang) => (
          <label key={lang} className={CHECKBOX_LABEL} style={{ color: 'var(--ink)' }}>
            <input
              type="checkbox"
              checked={filters.languages.includes(lang)}
              onChange={() => onChange({ ...filters, languages: toggle(filters.languages, lang) })}
            />
            {lang === 'en' ? 'English' : 'Japanese'}
          </label>
        ))}
      </div>

      {setNames.length > 0 && (
        <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--line)' }}>
          <p className="text-[12.5px] mb-1.5" style={{ color: 'var(--ink)' }}>
            Set
          </p>
          <div className="max-h-64 overflow-y-auto pr-1">
            {setNames.map((setName) => (
              <label key={setName} className={CHECKBOX_LABEL} style={{ color: 'var(--ink)' }}>
                <input
                  type="checkbox"
                  checked={filters.setNames.includes(setName)}
                  onChange={() => onChange({ ...filters, setNames: toggle(filters.setNames, setName) })}
                />
                {setName}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--line)' }}>
        <p className="text-[12.5px] mb-1.5" style={{ color: 'var(--ink)' }}>
          Price (R)
        </p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            step="0.01"
            placeholder="Min"
            value={filters.minPrice}
            onChange={(e) => onChange({ ...filters, minPrice: e.target.value })}
            className="w-full border rounded-[3px] px-2 py-1.5 text-[13px] bg-transparent"
            style={{ borderColor: 'var(--line)', color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}
          />
          <span style={{ color: 'var(--ink-muted)' }}>–</span>
          <input
            type="number"
            min={0}
            step="0.01"
            placeholder="Max"
            value={filters.maxPrice}
            onChange={(e) => onChange({ ...filters, maxPrice: e.target.value })}
            className="w-full border rounded-[3px] px-2 py-1.5 text-[13px] bg-transparent"
            style={{ borderColor: 'var(--line)', color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}
          />
        </div>
      </div>
    </div>
  )
}
