'use client'

import { useMemo, useState } from 'react'
import { ProductGrid, type Product } from './product-grid'
import { ProductFilters, EMPTY_FILTERS, applyShopFilters, type ShopFilterState } from './product-filters'
import { SubcategoryPills } from './subcategory-pills'

/** Owns the stackable language/set/grader/printStatus/price filters and re-derives the visible product list from them — the category tab above this stays server/URL-driven (app/shop/page.tsx), these are purely client-side on top of whatever that query already returned. */
export function ShopBrowser({ products, activeCategory }: { products: Product[]; activeCategory: string | null }) {
  const [filters, setFilters] = useState<ShopFilterState>(EMPTY_FILTERS)

  const filteredProducts = useMemo(() => {
    // Launch rollout: Graded inventory is ACE-only. app/shop/page.tsx's own
    // query already only fetches grading_company = 'ACE' rows for this
    // category, so this is defense-in-depth (same "browse-time half of the
    // rule" reasoning as that file's Raw Card price floor comment) rather
    // than the only thing enforcing it -- it also means the sidebar/pill
    // grader controls (both hidden below) can't be reached to undo it even
    // if a stale client somehow still rendered them.
    const effectiveFilters: ShopFilterState =
      activeCategory === 'graded' ? { ...filters, graders: ['ACE'] } : filters
    return applyShopFilters(products, effectiveFilters)
  }, [products, filters, activeCategory])

  return (
    <div>
      <SubcategoryPills activeCategory={activeCategory} filters={filters} onChange={setFilters} />
      <div className="flex flex-col lg:flex-row gap-8 mt-6 items-start">
        <ProductFilters
          products={products}
          filters={filters}
          onChange={setFilters}
          // Launch rollout: never show the Grader checkboxes -- Graded
          // inventory is locked to ACE only (see effectiveFilters above),
          // so there's nothing left to choose between. Was
          // `activeCategory === 'graded'`.
          showGraderFilter={false}
        />
        <div className="flex-1 min-w-0 w-full">
          <ProductGrid products={filteredProducts} />
        </div>
      </div>
    </div>
  )
}
