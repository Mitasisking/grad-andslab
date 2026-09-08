import { getSupabaseRouteClient } from '@/lib/supabase-route-client'
import { CategoryTabs } from '@/components/shop/category-tabs'
import { ProductTypeToggle } from '@/components/shop/product-type-toggle'
import { RegionToggle } from '@/components/shop/region-toggle'
import { SportsCardFilters } from '@/components/shop/sports-card-filters'
import { ShopBrowser } from '@/components/shop/shop-browser'
import { ProductGrid } from '@/components/shop/product-grid'
import { isOutOfPrint } from '@/lib/shop/availability'
import { REGION_OPTIONS, type ProductType, type ProductRegion } from '@/lib/shop/product-type'
import type { ShopUrlParams } from '@/lib/shop/shop-url'

const VALID_REGIONS = new Set(REGION_OPTIONS.map((r) => r.value))

// 'sealed-in-print' / 'sealed-out-of-print' aren't real products.category
// values -- both are still stored as 'sealed'. They're split here by
// release_date age instead, so the Shop UI's two tabs don't need their own
// database category.
const SEALED_SPLITS = new Set(['sealed-in-print', 'sealed-out-of-print'])

const PRODUCT_COLUMNS =
  'id, title, description, category, price, stock, images, set_name, release_date, card_type, sport, brand, card_variant, player_name, region'

function splitParam(value: string | undefined): string[] {
  return value ? value.split(',').filter(Boolean) : []
}

interface ShopSearchParams {
  category?: string
  productType?: string
  sport?: string
  brand?: string
  cardVariant?: string
  player?: string
  region?: string
}

export default async function ShopPage({ searchParams }: { searchParams: Promise<ShopSearchParams> }) {
  const { category, productType, sport, brand, cardVariant, player, region } = await searchParams
  const dbCategory = category && SEALED_SPLITS.has(category) ? 'sealed' : category
  const activeType: ProductType = productType === 'sports_card' ? 'sports_card' : 'pokemon'
  const activeRegion: ProductRegion = region && VALID_REGIONS.has(region as ProductRegion) ? (region as ProductRegion) : 'sa'

  const sports = splitParam(sport)
  const brands = splitParam(brand)
  const cardVariants = splitParam(cardVariant)

  const currentParams: ShopUrlParams = {
    category: category ?? null,
    productType: activeType === 'sports_card' ? 'sports_card' : null,
    sport: sports,
    brand: brands,
    cardVariant: cardVariants,
    player: player ?? null,
    region: activeRegion === 'sa' ? null : activeRegion,
  }

  const supabase = await getSupabaseRouteClient()

  // Only is_active products are visible here at all — enforced by
  // products_select_public_active_or_admin (0001_init_schema.sql), not
  // duplicated as a client-side filter. Scoped to one region so every
  // product on the page shares one currency (see components/shop/
  // region-toggle.tsx) -- products.price is never converted between
  // regions, so mixing them in one grid/price-filter would be meaningless.
  let baseQuery = supabase
    .from('products')
    .select(PRODUCT_COLUMNS)
    .eq('card_type', activeType)
    .eq('region', activeRegion)
    .order('created_at', { ascending: false })

  if (dbCategory) baseQuery = baseQuery.eq('category', dbCategory)

  // Fetched with only card_type + category applied — this is what the
  // sports-card sidebar derives its Brand checkbox options from, so
  // selecting e.g. one sport doesn't also collapse the Brand list down to
  // whatever that one sport still matches (same reasoning
  // components/shop/product-filters.tsx's Set/Language options already
  // rely on: derive facet options from the less-filtered list, apply the
  // full filter set only for the grid itself).
  const { data: baseData, error: baseError } = await baseQuery
  if (baseError) {
    // Surfaced server-side only — an empty grid from a genuinely broken
    // query (e.g. a pending migration) should never look identical to an
    // empty grid from a legitimate "nothing matches" result to whoever's
    // debugging it later.
    console.error('Shop products query failed', baseError.message)
  }
  const baseProducts = baseData ?? []

  let products = baseProducts

  if (activeType === 'sports_card') {
    let filteredQuery = supabase
      .from('products')
      .select(PRODUCT_COLUMNS)
      .eq('card_type', 'sports_card')
      .eq('region', activeRegion)
    if (dbCategory) filteredQuery = filteredQuery.eq('category', dbCategory)
    if (sports.length > 0) filteredQuery = filteredQuery.in('sport', sports)
    if (brands.length > 0) filteredQuery = filteredQuery.in('brand', brands)
    if (cardVariants.length > 0) filteredQuery = filteredQuery.in('card_variant', cardVariants)
    if (player?.trim()) {
      const term = player.trim().replace(/[%,]/g, '')
      filteredQuery = filteredQuery.or(`player_name.ilike.%${term}%,title.ilike.%${term}%`)
    }
    filteredQuery = filteredQuery.order('created_at', { ascending: false })

    const { data: filteredData, error: filteredError } = await filteredQuery
    if (filteredError) {
      console.error('Shop sports-card filter query failed', filteredError.message)
    }
    products = filteredData ?? []
  }

  if (category === 'sealed-in-print') {
    products = products.filter((p) => isOutOfPrint(p.release_date) === false)
  } else if (category === 'sealed-out-of-print') {
    products = products.filter((p) => isOutOfPrint(p.release_date) === true)
  }

  return (
    <div>
      <div className="flex flex-col items-center w-full gap-5 pb-8 mb-8 border-b" style={{ borderColor: 'var(--line)' }}>
        <RegionToggle active={activeRegion} current={currentParams} />
        <ProductTypeToggle active={activeType} current={currentParams} />
        <CategoryTabs active={category ?? null} current={currentParams} />
      </div>

      {activeType === 'sports_card' ? (
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          <SportsCardFilters facetSourceProducts={baseProducts} current={currentParams} />
          <div className="flex-1 min-w-0 w-full">
            <ProductGrid products={products} />
          </div>
        </div>
      ) : (
        <ShopBrowser products={products} />
      )}
    </div>
  )
}
