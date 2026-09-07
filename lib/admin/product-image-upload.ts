import { supabase } from '@/lib/supabase'

const BUCKET = 'product-images'

interface SignedUploadInit {
  path: string
  token: string
}

/**
 * Signed-URL upload flow (init -> upload), same shape as
 * lib/admin/photo-upload-client.ts's intake-photo flow. No confirm step:
 * unlike an intake item, a product row may not exist yet (New Product form),
 * so this just hands back the public URL for the form to hold in state --
 * it's saved to the row when the form itself is submitted.
 */
export async function uploadProductImage(file: File): Promise<string> {
  const initRes = await fetch('/api/admin/products/photo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName: file.name }),
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

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path)

  return publicUrl
}
