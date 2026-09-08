import { NextResponse } from 'next/server'
import { getSupabaseRouteClient } from '@/lib/supabase-route-client'

/**
 * Distinct sports-card brands from our own catalog (public.products, brand
 * column -- populated by the admin form's "Brand" field for card_type =
 * 'sports_card' rows, app/admin/shop/product-form-modal.tsx), for the
 * "Brand/Set" dropdown in the submit flow's Sports Cards search
 * (components/submit/card-shipment-row.tsx). Public/unauthenticated, same
 * as the shop's own product browsing -- products' RLS already allows
 * anonymous select.
 */
export async function GET() {
  const supabase = await getSupabaseRouteClient()

  const { data, error } = await supabase
    .from('products')
    .select('brand')
    .eq('card_type', 'sports_card')
    .not('brand', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const brands = Array.from(new Set((data ?? []).map((row) => row.brand as string))).sort()
  return NextResponse.json({ brands })
}
