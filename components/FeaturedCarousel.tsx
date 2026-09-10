'use client'

import { useEffect, useState } from 'react'
import { formatByRegion } from '@/lib/currency'
import type { FeaturedProduct } from '@/lib/shop/featured-products'

const CATEGORY_LABEL: Record<string, string> = {
  sealed: 'Sealed',
  accessories: 'Accessories',
  graded: 'Graded',
  cards: 'Raw Cards',
}

const AUTO_ROTATE_MS = 5000
const CARD_WIDTH = 260
const CARD_GAP = 20

function ChevronIcon({ direction, className }: { direction: 'left' | 'right'; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d={direction === 'left' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'} />
    </svg>
  )
}

function FeaturedCard({ product }: { product: FeaturedProduct }) {
  return (
    <div
      className="group shrink-0 rounded-xl border border-slate-800 bg-slate-900 overflow-hidden hover:border-amber-500/60 transition-colors duration-300"
      style={{ width: CARD_WIDTH }}
    >
      <div className="aspect-square bg-slate-950 flex items-center justify-center overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.images[0]}
          alt={product.title}
          loading="lazy"
          className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-300"
        />
      </div>
      <div className="p-4">
        <p className="text-[10.5px] font-bold uppercase tracking-wide text-amber-400 mb-1">
          {CATEGORY_LABEL[product.category] ?? product.category}
        </p>
        <p className="text-white text-[14.5px] font-semibold truncate">{product.title}</p>
        <p className="text-slate-300 text-[14px] mt-1.5" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {formatByRegion(product.price, product.region)}
        </p>
      </div>
    </div>
  )
}

/** Homepage "Premium Showcase" -- auto-rotating carousel of the region's 7 highest-priced listings. */
export function FeaturedCarousel({ products }: { products: FeaturedProduct[] }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const count = products.length

  // `index` is a dependency, not just state read inside the effect, so a
  // manual click (an arrow or a dot -- both go through goTo, which sets
  // index) tears down this interval and starts a fresh one instead of
  // firing on whatever's left of the previous countdown -- otherwise a
  // manual advance could be followed by an auto-advance a moment later.
  useEffect(() => {
    if (paused || count <= 1) return
    const id = setInterval(() => setIndex((i) => (i + 1) % count), AUTO_ROTATE_MS)
    return () => clearInterval(id)
  }, [paused, count, index])

  if (count === 0) return null

  function goTo(next: number) {
    setIndex(((next % count) + count) % count)
  }

  return (
    <section className="py-16 md:py-20 bg-neutral-950 border-y border-slate-800">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-10">
          <p className="text-amber-400 text-xs font-bold uppercase tracking-widest mb-2">Premium Grails</p>
          <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight">The Cuppa Cards Vault</h2>
        </div>

        <div
          className="relative"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <div className="overflow-hidden">
            <div
              className="flex transition-transform duration-500 ease-out"
              style={{ gap: CARD_GAP, transform: `translateX(-${index * (CARD_WIDTH + CARD_GAP)}px)` }}
            >
              {products.map((product) => (
                <FeaturedCard key={product.id} product={product} />
              ))}
            </div>
          </div>

          {count > 1 && (
            <>
              <button
                type="button"
                onClick={() => goTo(index - 1)}
                aria-label="Previous item"
                className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 items-center justify-center w-10 h-10 rounded-full bg-slate-900 border border-slate-700 hover:border-amber-500/60 text-amber-400 transition-colors"
              >
                <ChevronIcon direction="left" className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => goTo(index + 1)}
                aria-label="Next item"
                className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 items-center justify-center w-10 h-10 rounded-full bg-slate-900 border border-slate-700 hover:border-amber-500/60 text-amber-400 transition-colors"
              >
                <ChevronIcon direction="right" className="w-5 h-5" />
              </button>
            </>
          )}
        </div>

        {count > 1 && (
          <div className="flex justify-center gap-1.5 mt-8">
            {products.map((product, i) => (
              <button
                key={product.id}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Go to item ${i + 1}`}
                className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: i === index ? 20 : 6,
                  background: i === index ? '#a67c00' : '#3a3226',
                }}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
