import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { isOutOfPrint } from '@/lib/shop/availability'

interface VaultGrailToggleBody {
  isVaultGrail?: boolean
}

/**
 * Backs the "Feature in Vault" quick-toggle switch in the Shop Admin
 * inventory list (shop-admin-dashboard.tsx) -- same single-field-flip
 * reasoning as app/api/admin/products/[id]/auction/route.ts. Re-checks the
 * modern-sealed guardrail server-side (not just the UI's disabled switch)
 * since a quick-toggle request could otherwise bypass it directly.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const { supabase } = auth

  const body = (await request.json()) as VaultGrailToggleBody
  if (typeof body.isVaultGrail !== 'boolean') {
    return NextResponse.json({ error: 'isVaultGrail must be a boolean' }, { status: 400 })
  }

  if (body.isVaultGrail) {
    const { data: existing, error: fetchError } = await supabase
      .from('products')
      .select('category, release_date')
      .eq('id', id)
      .single()

    if (fetchError || !existing) return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    if (existing.category === 'sealed' && isOutOfPrint(existing.release_date) === false) {
      return NextResponse.json({ error: 'Modern sealed products cannot be featured in the Vault.' }, { status: 400 })
    }
  }

  const { data, error } = await supabase
    .from('products')
    .update({ is_vault_grail: body.isVaultGrail })
    .eq('id', id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  return NextResponse.json({ product: data })
}
