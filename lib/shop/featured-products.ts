import type { SupabaseClient } from '@supabase/supabase-js'
import type { ProductRegion } from '@/lib/shop/product-type'

export interface FeaturedProduct {
  id: string
  title: string
  category: string
  price: number
  images: string[]
  region: ProductRegion
}

const FEATURED_COLUMNS = 'id, title, category, price, images, region'

/**
 * Top (up to) 7 most expensive in-stock, visible products for one region --
 * feeds the homepage's "Premium Showcase" carousel
 * (components/FeaturedCarousel.tsx). Scoped to a single region for the same
 * reason app/shop/page.tsx's own queries are (0031_add_product_region.sql):
 * a product's price only means something in its own region's currency, so
 * ranking across regions would put a R99 South African card above a
 * genuinely expensive USD item.
 *
 * Fetches more than 7 (price DESC) and filters out anything with no photo
 * client-side, rather than asking Postgres to do it -- imageless listings
 * are common in this catalog (see components/shop/product-grid.tsx's own
 * `images.length > 0` filter), and the top 7 *by price* frequently isn't
 * the same set as the top 7 *by price with a photo*; over-fetching and
 * trimming here is simpler and more robust than an array-literal Postgrest
 * filter for a query this small.
 */
export async function getFeaturedProducts(
  supabase: SupabaseClient,
  region: ProductRegion,
): Promise<FeaturedProduct[]> {
  const { data, error } = await supabase
    .from('products')
    .select(FEATURED_COLUMNS)
    .eq('region', region)
    .eq('is_active', true)
    .eq('is_auction', false)
    .gt('stock', 0)
    .order('price', { ascending: false })
    .limit(30)

  if (error) {
    console.error('Featured products query failed', error.message)
    return []
  }

  return (data ?? []).filter((p) => p.images.length > 0).slice(0, 7) as FeaturedProduct[]
}
