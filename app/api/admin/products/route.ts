import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { validateProductInput, toProductRow, type ProductInput } from '@/lib/admin/product-input'

/**
 * List + create for the Shop Admin Dashboard (app/admin/shop). Runs under
 * the caller's own session (requireAdmin's supabase client, not a
 * service-role client) so products_insert_admin_only/select's RLS policies
 * (0001_init_schema.sql) are the actual gate, same as every other admin
 * route in this codebase.
 */

export async function GET() {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const { supabase } = auth

  const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false })

  if (error) {
    console.error('products list failed:', error.message)
    return NextResponse.json({ error: 'Could not load products' }, { status: 500 })
  }
  return NextResponse.json({ products: data })
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const { supabase } = auth

  const body = (await request.json()) as Partial<ProductInput>
  const validationError = validateProductInput(body)
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })

  const { data, error } = await supabase
    .from('products')
    .insert(toProductRow(body as ProductInput))
    .select('*')
    .single()

  if (error) {
    console.error('product insert failed:', error.message)
    return NextResponse.json({ error: 'Could not create product' }, { status: 500 })
  }
  return NextResponse.json({ product: data }, { status: 201 })
}
