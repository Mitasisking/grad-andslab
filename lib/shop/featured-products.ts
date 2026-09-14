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
 * Up to 7 admin-curated grails for one region -- feeds "The Cuppa's Cards
 * Vault" homepage carousel (components/FeaturedCarousel.tsx). Previously
 * auto-selected the top 7 highest-priced listings; now strictly
 * `is_vault_grail = true` (0057_add_product_is_vault_grail.sql, toggled from
 * the Shop Admin dashboard/product form), so a single expensive but
 * visually uninteresting listing can't dominate the showcase and a
 * deliberately-chosen piece can be featured regardless of price. Scoped to
 * a single region for the same reason app/shop/page.tsx's own queries are
 * (0031_add_product_region.sql): a product's price only means something in
 * its own region's currency.
 *
 * Fetches more than 7 (price DESC) and filters out anything with no photo
 * client-side, rather than asking Postgres to do it -- imageless listings
 * are common in this catalog (see components/shop/product-grid.tsx's own
 * `images.length > 0` filter), and over-fetching/trimming here is simpler
 * and more robust than an array-literal Postgrest filter for a query this
 * small.
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
    .eq('is_vault_grail', true)
    .gt('stock', 0)
    .order('price', { ascending: false })
    .limit(30)

  if (error) {
    console.error('Featured products query failed', error.message)
    return []
  }

  return (data ?? []).filter((p) => p.images.length > 0).slice(0, 7) as FeaturedProduct[]
}
