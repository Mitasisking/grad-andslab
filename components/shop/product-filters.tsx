'use client'

import { REGION_SYMBOL } from '@/lib/shop/product-type'
import { isOutOfPrint } from '@/lib/shop/availability'
import type { Product } from './product-grid'

export type Language = 'en' | 'jp'
export type Grader = 'PCG' | 'ACE'
/** 'all' means unfiltered -- matches EMPTY_FILTERS's convention for graders/languages ([] = unfiltered) but printStatus is single-select (the Sealed sub-pills), so 'all' fills that role instead of an empty array. */
export type PrintStatus = 'all' | 'in-print' | 'out-of-print'

export interface ShopFilterState {
  languages: Language[]
  setNames: string[]
  graders: Grader[]
  printStatus: PrintStatus
  minPrice: string
  maxPrice: string
}

export const EMPTY_FILTERS: ShopFilterState = {
  languages: [],
  setNames: [],
  graders: [],
  printStatus: 'all',
  minPrice: '',
  maxPrice: '',
}

/** Collectr tags every Japanese listing's title with this suffix — the one signal available, per app/api/fetch-images/route.ts's own JP-detection logic. */
export function isJapanese(title: string): boolean {
  return title.includes('(JP)')
}

/**
 * products has no dedicated set-language column either -- same situation as
 * isJapanese/matchesGrader above. Each set_name is exclusively one language
 * in practice (English and Japanese print runs never share a set name), so
 * a set's language is derived from whichever language its own listings'
 * titles carry, majority-vote in case a set is ever briefly mixed (e.g.
 * mid-import). Sets with zero titled products can't be classified and are
 * omitted from the map -- the caller treats an unmapped set as "always
 * visible" rather than guessing.
 */
export function deriveSetLanguages(products: Product[]): Record<string, Language> {
  const counts = new Map<string, { en: number; jp: number }>()

  for (const p of products) {
    if (!p.set_name) continue
    const entry = counts.get(p.set_name) ?? { en: 0, jp: 0 }
    if (isJapanese(p.title)) entry.jp += 1
    else entry.en += 1
    counts.set(p.set_name, entry)
  }

  const result: Record<string, Language> = {}
  for (const [setName, { en, jp }] of counts) {
    result[setName] = jp > en ? 'jp' : 'en'
  }
  return result
}

/**
 * products has no dedicated grading-company column -- graded listings are
 * distinguished from raw ones only by category = 'graded' (app/shop/
 * page.tsx's CATEGORIES), and nothing records which of our two active
 * partners (PCG/ACE — see app/page.tsx's hero copy) actually graded a given
 * slab. Same situation isJapanese above already accepts for language: a
 * text match against the title is the only signal there is, not a real
 * structured field. Sellers/admin should include the grader's name in the
 * listing title (e.g. "PCG 10 Charizard...") for this to actually match —
 * if that stops being reliable, a real products.grading_company column is
 * the fix, not a better regex here.
 */
export function matchesGrader(title: string, grader: Grader): boolean {
  return title.toUpperCase().includes(grader)
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
    if (filters.graders.length > 0 && !filters.graders.some((g) => matchesGrader(p.title, g))) return false
    if (filters.printStatus !== 'all') {
      const outOfPrint = isOutOfPrint(p.release_date)
      // A product whose release_date isn't known yet (outOfPrint === null)
      // matches neither specific bucket -- same "don't guess" stance
      // lib/shop/availability.ts's own doc comment takes.
      if (filters.printStatus === 'in-print' && outOfPrint !== false) return false
      if (filters.printStatus === 'out-of-print' && outOfPrint !== true) return false
    }
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
  /** Only the 'graded' category tab (app/shop/page.tsx's CATEGORIES) has a grading company to filter by at all — raw cards/sealed/accessories never do. */
  showGraderFilter?: boolean
}

const CHECKBOX_LABEL = 'flex items-center gap-2 text-[13.5px] py-1 cursor-pointer'
const GRADERS: Grader[] = ['PCG', 'ACE']

/** Sidebar filters for the shop grid — set/language facets are derived from whatever products the current category tab loaded, so they never offer a set or language that has zero matches. Checking exactly one language also narrows the Set list to that language's sets, so English/Japanese set names don't clutter each other. */
export function ProductFilters({ products, filters, onChange, showGraderFilter = false }: Props) {
  const allSetNames = Array.from(new Set(products.map((p) => p.set_name).filter((s): s is string => !!s))).sort(
    (a, b) => a.localeCompare(b),
  )

  // Only one language checked at a time narrows the Set list to that
  // language's sets -- neither checked, or both, falls back to showing
  // everything (requirement 3: an empty or "both" selection isn't a
  // meaningful narrowing signal the way exactly one language is).
  const setLanguages = deriveSetLanguages(products)
  const onlyLanguage = filters.languages.length === 1 ? filters.languages[0] : null
  const setNames = onlyLanguage
    ? allSetNames.filter((s) => setLanguages[s] === undefined || setLanguages[s] === onlyLanguage)
    : allSetNames
  // The shop page now scopes the whole grid to one region at a time, so
  // every product here shares one currency -- safe to label the range
  // filter with it instead of a currency-less "Price".
  const currencySymbol = products[0] ? REGION_SYMBOL[products[0].region] : null

  const hasActiveFilters =
    filters.languages.length > 0 ||
    filters.setNames.length > 0 ||
    filters.graders.length > 0 ||
    filters.printStatus !== 'all' ||
    filters.minPrice !== '' ||
    filters.maxPrice !== ''

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

      {showGraderFilter && (
        <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--line)' }}>
          <p className="text-[12.5px] mb-1.5" style={{ color: 'var(--ink)' }}>
            Grader
          </p>
          {GRADERS.map((grader) => (
            <label key={grader} className={CHECKBOX_LABEL} style={{ color: 'var(--ink)' }}>
              <input
                type="checkbox"
                checked={filters.graders.includes(grader)}
                onChange={() => onChange({ ...filters, graders: toggle(filters.graders, grader) })}
              />
              {grader}
            </label>
          ))}
        </div>
      )}

      <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--line)' }}>
        <p className="text-[12.5px] mb-1.5" style={{ color: 'var(--ink)' }}>
          Price{currencySymbol ? ` (${currencySymbol})` : ''}
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
