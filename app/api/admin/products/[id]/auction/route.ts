import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'

interface AuctionToggleBody {
  isAuction?: boolean
}

/**
 * Backs the "Send to Auction" quick-toggle switch in the Shop Admin
 * inventory list (shop-admin-dashboard.tsx) -- a single-field flip, not the
 * full product edit form, so it doesn't go through
 * app/api/admin/products/[id]'s PATCH (that one runs the whole
 * validateProductInput/toProductRow pipeline, which requires a complete
 * ProductInput body and would reject a bare `{ isAuction }` payload).
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const { supabase } = auth

  const body = (await request.json()) as AuctionToggleBody
  if (typeof body.isAuction !== 'boolean') {
    return NextResponse.json({ error: 'isAuction must be a boolean' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('products')
    .update({ is_auction: body.isAuction })
    .eq('id', id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  return NextResponse.json({ product: data })
}
