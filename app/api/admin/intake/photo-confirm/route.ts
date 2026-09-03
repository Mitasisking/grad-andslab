import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'

const BUCKET = 'submission-photos'

interface Body {
  itemId: string
  path: string
}

/**
 * Step 3 of the signed-URL upload flow (lib/admin/photo-upload-client.ts):
 * the file is already in Storage at `path` (step 2 uploaded straight there,
 * bypassing this server entirely) — this just resolves the public URL and
 * records it on the item. Realtime then pushes hi_res_photo_url straight to
 * the customer's dashboard.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const { supabase } = auth

  const body = (await request.json()) as Body
  if (!body.itemId || !body.path) {
    return NextResponse.json({ error: 'itemId and path are required' }, { status: 400 })
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(body.path)

  const { data: item, error } = await supabase
    .from('submission_items')
    .update({ hi_res_photo_url: publicUrl })
    .eq('id', body.itemId)
    .select('*')
    .single()

  if (error || !item) {
    return NextResponse.json({ error: error?.message ?? 'Could not save the photo to this item' }, { status: 500 })
  }

  return NextResponse.json({ item, url: publicUrl })
}
