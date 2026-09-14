import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getSupabaseRouteClient } from '@/lib/supabase-route-client'
import { formatByRegion } from '@/lib/currency'
import { AddToCartButton } from '@/components/shop/add-to-cart-button'
import type { ProductRegion } from '@/lib/shop/product-type'

const PRODUCT_COLUMNS =
  'id, title, description, category, price, stock, images, set_name, release_date, card_type, sport, brand, card_variant, player_name, region, lore, is_active, is_auction'

interface ProductDetail {
  id: string
  title: string
  description: string | null
  category: string
  price: number
  stock: number
  images: string[]
  set_name: string | null
  release_date: string | null
  card_type: 'pokemon' | 'sports_card' | null
  sport: string | null
  brand: string | null
  card_variant: string | null
  player_name: string | null
  region: ProductRegion
  lore: string | null
  is_active: boolean
  is_auction: boolean
}

async function getProduct(id: string): Promise<ProductDetail | null> {
  const supabase = await getSupabaseRouteClient()
  const { data } = await supabase.from('products').select(PRODUCT_COLUMNS).eq('id', id).single()
  return data
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const product = await getProduct(id)
  if (!product) return { title: "Shop | Cuppa's Cards" }
  return { title: `${product.title} | Cuppa's Cards` }
}

/**
 * Individual product detail page, linked from every card in
 * components/shop/product-grid.tsx. Auction-staged listings live only on
 * the Live Auctions "Coming Soon" grid (0054_add_product_is_auction.sql) --
 * shelved for now, so this route treats one the same as not found rather
 * than rendering a page for a feature that's currently unreachable anywhere
 * else. An inactive product 404s too, matching products_select_public_
 * active_or_admin's own RLS policy (0001_init_schema.sql): this route makes
 * no admin exception, since only the public storefront links here.
 */
export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const product = await getProduct(id)

  if (!product || !product.is_active || product.is_auction) notFound()

  // Same premium price floor as product-grid.tsx's own MIN_CARD_PRICE --
  // a stale direct link to a sub-R100 Raw Card should still show the page
  // (it's a real product), just not let it be bought here either.
  const belowPriceFloor = product.category === 'cards' && product.price < 100

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <Link href="/shop" className="text-[13px] underline underline-offset-2" style={{ color: 'var(--ink-muted)' }}>
        ← Back to Shop
      </Link>

      <div className="grid md:grid-cols-2 gap-10 mt-6">
        <div
          className="aspect-square flex items-center justify-center rounded-[3px] border"
          style={{ background: 'var(--paper-raised)', borderColor: 'var(--line)' }}
        >
          {product.images[0] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.images[0]} alt={product.title} className="w-full h-full object-contain p-8" />
          )}
        </div>

        <div className="flex flex-col">
          <h1 className="text-[26px]" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
            {product.title}
          </h1>
          {product.set_name && (
            <p className="text-[14px] mt-1" style={{ color: 'var(--ink-muted)' }}>
              {product.set_name}
            </p>
          )}

          <p
            className="text-[26px] mt-4"
            style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}
          >
            {formatByRegion(product.price, product.region)}
          </p>

          {product.description && (
            <p className="text-[14px] mt-4 leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
              {product.description}
            </p>
          )}

          {product.lore && (
            <div className="mt-5 pl-4 border-l-2" style={{ borderColor: 'var(--vault)' }}>
              <p
                className="text-[11px] uppercase tracking-wide"
                style={{ color: 'var(--ink-muted)', letterSpacing: '0.06em' }}
              >
                The Story of this Card
              </p>
              <p className="text-[13.5px] italic mt-1.5 leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
                {product.lore}
              </p>
            </div>
          )}

          <div className="mt-8">
            <AddToCartButton
              product={{
                id: product.id,
                title: product.title,
                price: product.price,
                images: product.images,
                stock: product.stock,
                region: product.region,
              }}
              belowPriceFloor={belowPriceFloor}
            />
          </div>
        </div>
      </div>
    </main>
  )
}
