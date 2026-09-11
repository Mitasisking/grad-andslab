'use client'

import type { Grader, PrintStatus, ShopFilterState } from './product-filters'

interface Props {
  activeCategory: string | null
  filters: ShopFilterState
  onChange: (filters: ShopFilterState) => void
}

const GRADER_OPTIONS: { value: Grader | null; label: string }[] = [
  { value: null, label: 'All Graded' },
  { value: 'PCG', label: 'PCG' },
  { value: 'ACE', label: 'ACE' },
]

const PRINT_STATUS_OPTIONS: { value: PrintStatus; label: string }[] = [
  { value: 'all', label: 'All Sealed' },
  { value: 'in-print', label: 'In-Print' },
  { value: 'out-of-print', label: 'Out-of-Print' },
]

const PILL_BASE = 'px-2.5 py-1 text-[12px] rounded-full transition-colors duration-200'

/**
 * Quick-filter sub-nav shown directly under the main category bar (app/shop/
 * page.tsx renders CategoryTabs, then ShopBrowser -- this is the first thing
 * ShopBrowser renders) -- one row for 'graded', a different one for
 * 'sealed', nothing for any other category. Deliberately smaller/lighter
 * than CategoryTabs (12px + tighter padding vs. CategoryTabs' 13.5px) so it
 * reads as a sub-menu of the main bar, not a second equal-weight nav.
 *
 * Both rows write into the same ShopFilterState the sidebar already owns
 * (ProductFilters' Grader checkboxes, and applyShopFilters' printStatus
 * check) rather than inventing parallel state -- "All Graded"/"All Sealed"
 * are just the empty/unfiltered value for that field, exactly like clearing
 * the sidebar's own controls would produce.
 */
export function SubcategoryPills({ activeCategory, filters, onChange }: Props) {
  if (activeCategory === 'graded') {
    const activeGrader = filters.graders[0] ?? null
    return (
      <div className="flex flex-wrap justify-center gap-1.5 mb-2">
        {GRADER_OPTIONS.map((opt) => {
          const selected = opt.value === null ? filters.graders.length === 0 : activeGrader === opt.value
          return (
            <button
              key={opt.label}
              type="button"
              onClick={() => onChange({ ...filters, graders: opt.value ? [opt.value] : [] })}
              className={PILL_BASE}
              style={{
                background: selected ? 'var(--seal)' : 'transparent',
                color: selected ? 'var(--seal-ink)' : 'var(--ink-muted)',
                border: selected ? 'none' : '1px solid var(--line)',
              }}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    )
  }

  if (activeCategory === 'sealed') {
    return (
      <div className="flex flex-wrap justify-center gap-1.5 mb-2">
        {PRINT_STATUS_OPTIONS.map((opt) => {
          const selected = filters.printStatus === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ ...filters, printStatus: opt.value })}
              className={PILL_BASE}
              style={{
                background: selected ? 'var(--seal)' : 'transparent',
                color: selected ? 'var(--seal-ink)' : 'var(--ink-muted)',
                border: selected ? 'none' : '1px solid var(--line)',
              }}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    )
  }

  return null
}
