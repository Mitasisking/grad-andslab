import type { Metadata } from 'next'
import Link from 'next/link'
import { CartProvider } from '@/lib/cart/cart-context'
import { CartButton } from '@/components/shop/cart-button'

export const metadata: Metadata = {
  title: 'Shop',
  description: 'Sealed product, accessories, and graded slabs.',
}

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <div style={{ background: 'var(--paper)', color: 'var(--ink)', minHeight: '100vh' }}>
      <div className="mx-auto max-w-5xl px-6 py-10 lg:py-16">
        <div className="flex items-center justify-between mb-10">
          <Link href="/shop" className="text-[22px]" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
            Shop
          </Link>
          <CartButton />
        </div>
        {children}
      </div>
      </div>
    </CartProvider>
  )
}
