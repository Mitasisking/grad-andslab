import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'

const BUCKET = 'product-images'

interface Body {
  fileName: string
}

/**
 * Step 1 of the signed-URL upload flow (lib/admin/product-image-upload.ts):
 * mints a one-time upload slot in the product-images bucket. Not scoped to
 * a product id -- a New Product upload happens before the row exists -- so
 * the path is just a random name, same as the file's own extension.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const { supabase } = auth

  const body = (await request.json()) as Body
  if (!body.fileName) {
    return NextResponse.json({ error: 'fileName is required' }, { status: 400 })
  }

  const extension = body.fileName.includes('.') ? body.fileName.split('.').pop() : undefined
  const path = `${crypto.randomUUID()}${extension ? `.${extension}` : ''}`

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path)

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Could not create an upload slot' }, { status: 500 })
  }

  return NextResponse.json({ path: data.path, token: data.token })
}
