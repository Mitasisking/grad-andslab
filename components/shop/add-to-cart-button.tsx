'use client'

import { useState } from 'react'
import { useCart } from '@/lib/cart/cart-context'
import type { ProductRegion } from '@/lib/shop/product-type'

interface Props {
  product: {
    id: string
    title: string
    price: number
    images: string[]
    stock: number
    region: ProductRegion
  }
  /** Raw Cards under R100 aren't sold individually (0056_raw_card_price_floor.sql) -- a stale direct link to one should still show the product, just not let it be bought. */
  belowPriceFloor?: boolean
}

/** Full-size Add to Cart control for the product detail page (app/shop/[id]/page.tsx) -- components/shop/product-grid.tsx has its own compact inline version for the grid card. */
export function AddToCartButton({ product, belowPriceFloor = false }: Props) {
  const { addItem } = useCart()
  const [error, setError] = useState<string | null>(null)
  const [added, setAdded] = useState(false)
  const outOfStock = product.stock <= 0
  const disabled = outOfStock || belowPriceFloor

  function handleClick() {
    const result = addItem(product)
    if (result.ok) {
      setError(null)
      setAdded(true)
      setTimeout(() => setAdded(false), 1500)
    } else {
      setError(result.error)
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className="px-6 py-3 text-[14px] rounded-[3px] disabled:opacity-40"
        style={{ background: 'var(--vault)', color: 'var(--vault-ink)' }}
      >
        {outOfStock ? 'Sold out' : belowPriceFloor ? 'Not sold individually' : added ? 'Added ✓' : 'Add to cart'}
      </button>
      {error && (
        <p className="text-[13px] mt-2" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}
    </div>
  )
}
