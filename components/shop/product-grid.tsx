'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useCart } from '@/lib/cart/cart-context'
import { formatByRegion } from '@/lib/currency'
import type { ProductRegion } from '@/lib/shop/product-type'

export interface Product {
  id: string
  title: string
  description: string | null
  category: string
  price: number
  stock: number
  images: string[]
  set_name: string | null
  release_date: string | null
  card_type?: 'pokemon' | 'sports_card'
  sport?: string | null
  brand?: string | null
  card_variant?: string | null
  player_name?: string | null
  region: ProductRegion
  /** Optional ~100-word collector story -- see 0058_add_product_lore.sql. */
  lore?: string | null
}

// Premium price floor: Raw Cards under R100 aren't sold individually.
// app/shop/page.tsx's own query already excludes these (and create_order()
// rejects one at checkout regardless — see 0056_raw_card_price_floor.sql),
// so this is a second, defense-in-depth layer for any other data source
// that ever renders through this same grid.
const MIN_CARD_PRICE = 100

/** Quick add-to-cart, no navigation required — per app/auctions/README.md's Phase 4 file map. */
export function ProductGrid({ products }: { products: Product[] }) {
  const { addItem } = useCart()
  const [cartError, setCartError] = useState<string | null>(null)
  const visibleProducts = products.filter(
    (p) => (p.category !== 'cards' || p.price >= MIN_CARD_PRICE) && p.images.length > 0,
  )

  function handleAddItem(e: React.MouseEvent, product: Product) {
    // The whole card is now a <Link> to /shop/[id] -- without these, this
    // click would both add to cart AND navigate away to the detail page,
    // since a click on a descendant still bubbles up to (and activates) the
    // enclosing anchor.
    e.preventDefault()
    e.stopPropagation()
    const result = addItem(product)
    setCartError(result.ok ? null : result.error)
  }

  if (visibleProducts.length === 0) {
    return (
      <p className="text-[14px] py-16 text-center" style={{ color: 'var(--ink-muted)' }}>
        Nothing here right now.
      </p>
    )
  }

  return (
    <div>
      {cartError && (
        <p className="text-[13px] mb-4" style={{ color: 'var(--danger)' }}>
          {cartError}
        </p>
      )}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {visibleProducts.map((product) => {
        const outOfStock = product.stock <= 0
        return (
          <Link
            key={product.id}
            href={`/shop/${product.id}`}
            className="border rounded-[3px] overflow-hidden flex flex-col transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-[0_12px_24px_-8px_rgba(232,184,75,0.35)]"
            style={{ borderColor: 'var(--line)' }}
          >
            <div className="aspect-square flex items-center justify-center" style={{ background: 'var(--paper-raised)' }}>
              {product.images[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={product.images[0]} alt={product.title} className="w-full h-full object-contain p-4" />
              )}
            </div>
            <div className="p-4 flex flex-col flex-1">
              <p className="text-[14.5px]" style={{ color: 'var(--ink)' }}>
                {product.title}
              </p>
              {product.set_name && (
                <p className="text-[12.5px] mt-0.5" style={{ color: 'var(--ink-muted)' }}>
                  {product.set_name}
                </p>
              )}
              {product.description && (
                <p className="text-[12.5px] mt-1 line-clamp-2" style={{ color: 'var(--ink-muted)' }}>
                  {product.description}
                </p>
              )}
              {product.lore && (
                <div className="mt-3 pl-3 border-l-2" style={{ borderColor: 'var(--vault)' }}>
                  <p
                    className="text-[10.5px] uppercase tracking-wide"
                    style={{ color: 'var(--ink-muted)', letterSpacing: '0.06em' }}
                  >
                    The Story of this Card
                  </p>
                  <p className="text-[12.5px] italic mt-1 line-clamp-4" style={{ color: 'var(--ink-muted)' }}>
                    {product.lore}
                  </p>
                </div>
              )}
              <div className="flex items-center justify-between mt-auto pt-4">
                <span className="text-[15px]" style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>
                  {formatByRegion(product.price, product.region)}
                </span>
                <button
                  type="button"
                  onClick={(e) => handleAddItem(e, product)}
                  disabled={outOfStock}
                  className="px-3 py-1.5 text-[13px] rounded-[3px] disabled:opacity-40"
                  style={{ background: 'var(--vault)', color: 'var(--vault-ink)' }}
                >
                  {outOfStock ? 'Sold out' : 'Add to cart'}
                </button>
              </div>
            </div>
          </Link>
          )
        })}
      </div>
    </div>
  )
}