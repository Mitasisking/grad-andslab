'use client'

import { useMemo, useState } from 'react'
import { ProductGrid, type Product } from './product-grid'
import { ProductFilters, EMPTY_FILTERS, applyShopFilters, type ShopFilterState } from './product-filters'

/** Owns the stackable language/set/price filters and re-derives the visible product list from them — the category tab above this stays server/URL-driven (app/shop/page.tsx), these are purely client-side on top of whatever that query already returned. */
export function ShopBrowser({ products }: { products: Product[] }) {
  const [filters, setFilters] = useState<ShopFilterState>(EMPTY_FILTERS)

  const filteredProducts = useMemo(() => applyShopFilters(products, filters), [products, filters])

  return (
    <div className="flex flex-col lg:flex-row gap-8 mt-6 items-start">
      <ProductFilters products={products} filters={filters} onChange={setFilters} />
      <div className="flex-1 min-w-0 w-full">
        <ProductGrid products={filteredProducts} />
      </div>
    </div>
  )
}
