import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { validateProductInput, toProductRow, type ProductInput } from '@/lib/admin/product-input'

/**
 * Bulk create for callers that already have several fully-formed product
 * rows ready to go (app/admin/shop/bulk-ace-import) -- one supabase.insert()
 * call across the whole array, so N rows become a single INSERT statement
 * (and a single round trip) instead of the one-row-at-a-time loop
 * app/api/admin/products/route.ts's POST does for the "+ New Product" form.
 * Same requireAdmin gate and validateProductInput/toProductRow shaping as
 * that route, applied per row, so a bad row is rejected the same way either
 * path in.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const { supabase } = auth

  const body = (await request.json()) as { products?: Partial<ProductInput>[] }
  const inputs = body.products
  if (!Array.isArray(inputs) || inputs.length === 0) {
    return NextResponse.json({ error: 'products must be a non-empty array.' }, { status: 400 })
  }

  for (const [index, input] of inputs.entries()) {
    const validationError = validateProductInput(input)
    if (validationError) {
      return NextResponse.json({ error: `Row ${index + 1}: ${validationError}` }, { status: 400 })
    }
  }

  const { data, error } = await supabase
    .from('products')
    .insert(inputs.map((input) => toProductRow(input as ProductInput)))
    .select('*')

  if (error) {
    console.error('batch product insert failed:', error.message)
    return NextResponse.json({ error: 'Could not create products' }, { status: 500 })
  }
  return NextResponse.json({ products: data }, { status: 201 })
}
