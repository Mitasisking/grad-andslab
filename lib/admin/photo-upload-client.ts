import { supabase } from '@/lib/supabase'

const BUCKET = 'submission-photos'

interface SignedUploadInit {
  path: string
  token: string
}

/**
 * Signed-URL upload flow (init -> upload -> confirm), per app/shop/README.md:
 * ask the server for a scoped, one-time upload slot rather than proxying
 * image bytes through a Next.js route, upload the file bytes directly to
 * Supabase Storage, then tell the server to record the resulting path on
 * the item so it can resolve and save the public URL.
 *
 * Depends on two admin API routes that are still unwritten —
 * app/api/admin/intake/photo/route.ts (init: mint the signed upload URL
 * for this itemId) and app/api/admin/intake/photo-confirm/route.ts
 * (confirm: set submission_items.hi_res_photo_url from the uploaded path) —
 * so this compiles and is ready to call, but won't succeed at runtime until
 * those exist.
 */
export async function uploadIntakePhoto(itemId: string, file: File): Promise<void> {
  const initRes = await fetch('/api/admin/intake/photo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemId, fileName: file.name }),
  })
  if (!initRes.ok) {
    const data = await initRes.json().catch(() => null)
    throw new Error(data?.error ?? 'Could not start the upload')
  }
  const { path, token } = (await initRes.json()) as SignedUploadInit

  const { error: uploadError } = await supabase.storage.from(BUCKET).uploadToSignedUrl(path, token, file)
  if (uploadError) {
    throw new Error(uploadError.message)
  }

  const confirmRes = await fetch('/api/admin/intake/photo-confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemId, path }),
  })
  if (!confirmRes.ok) {
    const data = await confirmRes.json().catch(() => null)
    throw new Error(data?.error ?? 'Upload succeeded but could not be saved to the item')
  }
}
