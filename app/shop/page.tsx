import { getSupabaseRouteClient } from '@/lib/supabase-route-client'
import { CategoryTabs } from '@/components/shop/category-tabs'
import { ProductGrid } from '@/components/shop/product-grid'

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  const { category } = await searchParams
  const supabase = await getSupabaseRouteClient()

  // Only is_active products are visible here at all — enforced by
  // products_select_public_active_or_admin (0001_init_schema.sql), not
  // duplicated as a client-side filter.
  let query = supabase
    .from('products')
    .select('id, title, description, category, price, stock, images, set_name')
    .order('created_at', { ascending: false })

  if (category) {
    query = query.eq('category', category)
  }

  const { data: products } = await query

  return (
    <div>
      <CategoryTabs active={category ?? null} />
      <ProductGrid products={products ?? []} />
    </div>
  )
}
