'use client'

import { useCart } from '@/lib/cart/cart-context'

interface Product {
  id: string
  title: string
  description: string | null
  category: string
  price: number
  stock: number
  images: string[]
}

/** Quick add-to-cart, no navigation required — per app/auctions/README.md's Phase 4 file map. */
export function ProductGrid({ products }: { products: Product[] }) {
  const { addItem } = useCart()

  if (products.length === 0) {
    return (
      <p className="text-[14px] py-16 text-center" style={{ color: 'var(--ink-muted)' }}>
        Nothing here right now.
      </p>
    )
  }

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
      {products.map((product) => {
        const outOfStock = product.stock <= 0
        return (
          <div
            key={product.id}
            className="border rounded-[3px] overflow-hidden flex flex-col"
            style={{ borderColor: 'var(--line)' }}
          >
            <div className="aspect-square" style={{ background: 'var(--paper-raised)' }}>
              {product.images[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={product.images[0]} alt={product.title} className="w-full h-full object-cover" />
              )}
            </div>
            <div className="p-4 flex flex-col flex-1">
              <p className="text-[14.5px]" style={{ color: 'var(--ink)' }}>
                {product.title}
              </p>
              {product.description && (
                <p className="text-[12.5px] mt-1 line-clamp-2" style={{ color: 'var(--ink-muted)' }}>
                  {product.description}
                </p>
              )}
              <div className="flex items-center justify-between mt-auto pt-4">
                <span className="text-[15px]" style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>
                  ${product.price.toFixed(2)}
                </span>
                <button
                  type="button"
                  onClick={() => addItem(product)}
                  disabled={outOfStock}
                  className="px-3 py-1.5 text-[13px] rounded-[3px] disabled:opacity-40"
                  style={{ background: 'var(--vault)', color: 'var(--vault-ink)' }}
                >
                  {outOfStock ? 'Sold out' : 'Add to cart'}
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
