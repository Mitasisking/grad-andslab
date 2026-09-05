import { getSupabaseRouteClient } from '@/lib/supabase-route-client'
import { CategoryTabs } from '@/components/shop/category-tabs'
import { ShopBrowser } from '@/components/shop/shop-browser'
import { isOutOfPrint } from '@/lib/shop/availability'

// 'sealed-in-print' / 'sealed-out-of-print' aren't real products.category
// values -- both are still stored as 'sealed'. They're split here by
// release_date age instead, so the Shop UI's two tabs don't need their own
// database category.
const SEALED_SPLITS = new Set(['sealed-in-print', 'sealed-out-of-print'])

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  const { category } = await searchParams
  const dbCategory = category && SEALED_SPLITS.has(category) ? 'sealed' : category
  const supabase = await getSupabaseRouteClient()

  // Only is_active products are visible here at all — enforced by
  // products_select_public_active_or_admin (0001_init_schema.sql), not
  // duplicated as a client-side filter.
  let query = supabase
    .from('products')
    .select('id, title, description, category, price, stock, images, set_name, release_date')
    .order('created_at', { ascending: false })

  if (dbCategory) {
    query = query.eq('category', dbCategory)
  }

  const { data } = await query
  let products = data ?? []

  if (category === 'sealed-in-print') {
    products = products.filter((p) => isOutOfPrint(p.release_date) === false)
  } else if (category === 'sealed-out-of-print') {
    products = products.filter((p) => isOutOfPrint(p.release_date) === true)
  }

  return (
    <div>
      <CategoryTabs active={category ?? null} />
      <ShopBrowser products={products} />
    </div>
  )
}
