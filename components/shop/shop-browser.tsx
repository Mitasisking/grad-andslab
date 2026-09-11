'use client'

import { useMemo, useState } from 'react'
import { ProductGrid, type Product } from './product-grid'
import { ProductFilters, EMPTY_FILTERS, applyShopFilters, type ShopFilterState } from './product-filters'
import { SubcategoryPills } from './subcategory-pills'

/** Owns the stackable language/set/grader/printStatus/price filters and re-derives the visible product list from them — the category tab above this stays server/URL-driven (app/shop/page.tsx), these are purely client-side on top of whatever that query already returned. */
export function ShopBrowser({ products, activeCategory }: { products: Product[]; activeCategory: string | null }) {
  const [filters, setFilters] = useState<ShopFilterState>(EMPTY_FILTERS)

  const filteredProducts = useMemo(() => applyShopFilters(products, filters), [products, filters])

  return (
    <div>
      <SubcategoryPills activeCategory={activeCategory} filters={filters} onChange={setFilters} />
      <div className="flex flex-col lg:flex-row gap-8 mt-6 items-start">
        <ProductFilters
          products={products}
          filters={filters}
          onChange={setFilters}
          showGraderFilter={activeCategory === 'graded'}
        />
        <div className="flex-1 min-w-0 w-full">
          <ProductGrid products={filteredProducts} />
        </div>
      </div>
    </div>
  )
}
