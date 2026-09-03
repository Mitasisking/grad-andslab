import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRouteClient } from '@/lib/supabase-route-client'

interface OrderItemInput {
  productId: string
  quantity: number
}

interface Body {
  addressId: string
  shippingCost: number
  items: OrderItemInput[]
}

interface OrderResult {
  id: string
  total: number
}

/**
 * Price and stock are verified inside create_order() itself
 * (supabase/migrations/0008_rls_hardening_medium.sql), not here — the
 * client only ever supplies a product id and quantity per line, never a
 * price or title, so there's nothing for a tampered request to override.
 */
export async function POST(request: NextRequest) {
  const supabase = await getSupabaseRouteClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = (await request.json()) as Body
  if (!body.items?.length) return NextResponse.json({ error: 'Cart is empty' }, { status: 400 })
  if (!body.addressId) return NextResponse.json({ error: 'A shipping address is required' }, { status: 400 })

  // create_order() returns public.orders as a single row (not setof), so
  // PostgREST hands it back as one object, not an array.
  const { data: order, error } = await supabase.rpc('create_order', {
    p_address_id: body.addressId,
    p_shipping_cost: body.shippingCost ?? 0,
    p_items: body.items.map((item) => ({ product_id: item.productId, quantity: item.quantity })),
  })

  if (error || !order) {
    return NextResponse.json({ error: error?.message ?? 'Could not create order' }, { status: 400 })
  }

  const result = order as OrderResult
  return NextResponse.json({ orderId: result.id, total: result.total })
}
