import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRouteClient } from '@/lib/supabase-route-client'

interface Body {
  itemId: string
  title: string
  description?: string | null
  startingPrice: number
  reservePrice?: number | null
  durationHours: number
}

/**
 * Creates an auction listing from a graded submission_item — the "publish"
 * step of the Grade-to-Auction pipeline (app/auctions/README.md), reached
 * from AuctionDraftForm at /auctions/new. That page already checks
 * ownership and grading before rendering the form, but this route re-checks
 * both itself rather than trusting the client got here honestly.
 */
export async function POST(request: NextRequest) {
  const supabase = await getSupabaseRouteClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = (await request.json()) as Body

  if (!body.itemId || !body.title?.trim()) {
    return NextResponse.json({ error: 'itemId and title are required' }, { status: 400 })
  }
  if (!Number.isFinite(body.startingPrice) || body.startingPrice <= 0) {
    return NextResponse.json({ error: 'A valid starting price is required' }, { status: 400 })
  }
  if (!Number.isFinite(body.durationHours) || body.durationHours <= 0) {
    return NextResponse.json({ error: 'A valid duration is required' }, { status: 400 })
  }
  if (body.reservePrice != null && body.reservePrice < body.startingPrice) {
    return NextResponse.json({ error: 'Reserve price cannot be below the starting price' }, { status: 400 })
  }

  const { data: item, error: itemError } = await supabase
    .from('submission_items')
    .select('id, hi_res_photo_url, grade_result, submissions(user_id, status)')
    .eq('id', body.itemId)
    .single()

  if (itemError || !item) {
    return NextResponse.json({ error: 'Card not found' }, { status: 404 })
  }

  // Without generated Supabase types this to-one embed still infers as an
  // array (see app/auctions/new/page.tsx) — it's a single row at runtime.
  const rawSubmission = item.submissions
  const submission = Array.isArray(rawSubmission) ? rawSubmission[0] : rawSubmission

  if (!submission || submission.status !== 'graded' || item.grade_result === null || submission.user_id !== user.id) {
    return NextResponse.json({ error: 'This card is not eligible for auction' }, { status: 403 })
  }

  const { data: existingAuction } = await supabase
    .from('auctions')
    .select('id')
    .eq('item_id', body.itemId)
    .in('status', ['active', 'extended'])
    .maybeSingle()

  if (existingAuction) {
    return NextResponse.json(
      { error: 'This card is already listed', auctionId: existingAuction.id },
      { status: 400 },
    )
  }

  const endsAt = new Date(Date.now() + body.durationHours * 60 * 60 * 1000).toISOString()

  const { data: auction, error: auctionError } = await supabase
    .from('auctions')
    .insert({
      item_id: body.itemId,
      seller_id: user.id,
      title: body.title.trim(),
      description: body.description || null,
      images: item.hi_res_photo_url ? [item.hi_res_photo_url] : [],
      starting_price: body.startingPrice,
      reserve_price: body.reservePrice ?? null,
      ends_at: endsAt,
    })
    .select('id')
    .single()

  if (auctionError || !auction) {
    return NextResponse.json({ error: auctionError?.message ?? 'Could not create the listing' }, { status: 500 })
  }

  return NextResponse.json({ auctionId: auction.id })
}
