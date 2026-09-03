import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'

const BUCKET = 'submission-photos'

interface Body {
  itemId: string
  fileName: string
}

/**
 * Step 1 of the signed-URL upload flow (lib/admin/photo-upload-client.ts):
 * mints a one-time upload slot in Supabase Storage for one submission item.
 * The path is generated here, not taken from the client, so an admin
 * session can't be tricked into overwriting another item's photo.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const { supabase } = auth

  const body = (await request.json()) as Body
  if (!body.itemId || !body.fileName) {
    return NextResponse.json({ error: 'itemId and fileName are required' }, { status: 400 })
  }

  const extension = body.fileName.includes('.') ? body.fileName.split('.').pop() : undefined
  const path = `${body.itemId}/${crypto.randomUUID()}${extension ? `.${extension}` : ''}`

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path)

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Could not create an upload slot' }, { status: 500 })
  }

  return NextResponse.json({ path: data.path, token: data.token })
}
