import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'

interface Body {
  itemId: string
  title: string
  description?: string | null
  startingPrice: number
  reservePrice?: number | null
}

const WEEKLY_FEATURE_DURATION_DAYS = 28

interface SubmissionEmbed {
  user_id: string
  status: string
}

/**
 * Queues a graded card into the staggered weekly "Live Auctions" program --
 * the admin-curated counterpart to app/api/auctions/route.ts's self-service
 * listing flow. Deliberately admin-only and NOT restricted to the caller's
 * own cards: this project's consignment model (submissions.
 * interested_in_consignment) means the business schedules other customers'
 * graded cards into the program on their behalf, so seller_id here is the
 * card's real owner (the consignor), not the admin doing the scheduling.
 *
 * starts_at/ends_at are never accepted from the caller -- they're always
 * computed by public.next_weekly_feature_start()
 * (0046_staggered_weekly_auctions.sql), so the 7-day stagger and the
 * Friday-anchoring it depends on can't be thrown off by a typo or a manual
 * date pick.
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdmin()
  if ('error' in guard) return guard.error
  const { supabase } = guard

  const body = (await request.json()) as Body

  if (!body.itemId || !body.title?.trim()) {
    return NextResponse.json({ error: 'itemId and title are required' }, { status: 400 })
  }
  if (!Number.isFinite(body.startingPrice) || body.startingPrice <= 0) {
    return NextResponse.json({ error: 'A valid starting price is required' }, { status: 400 })
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
  // array (same quirk app/api/auctions/route.ts already documents) -- it's
  // a single row at runtime.
  const rawSubmission = item.submissions as unknown as SubmissionEmbed | SubmissionEmbed[] | null
  const submission = Array.isArray(rawSubmission) ? rawSubmission[0] : rawSubmission

  if (!submission || submission.status !== 'graded' || item.grade_result === null) {
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

  const { data: startsAtResult, error: startsAtError } = await supabase.rpc('next_weekly_feature_start')
  if (startsAtError || !startsAtResult) {
    return NextResponse.json(
      { error: startsAtError?.message ?? 'Could not compute the next weekly slot' },
      { status: 500 },
    )
  }

  const startsAt = new Date(startsAtResult as string)
  const endsAt = new Date(startsAt.getTime() + WEEKLY_FEATURE_DURATION_DAYS * 24 * 60 * 60 * 1000)

  const { data: auction, error: auctionError } = await supabase
    .from('auctions')
    .insert({
      item_id: body.itemId,
      seller_id: submission.user_id,
      title: body.title.trim(),
      description: body.description || null,
      images: item.hi_res_photo_url ? [item.hi_res_photo_url] : [],
      starting_price: body.startingPrice,
      reserve_price: body.reservePrice ?? null,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      is_weekly_feature: true,
    })
    .select('id, starts_at, ends_at')
    .single()

  if (auctionError || !auction) {
    return NextResponse.json({ error: auctionError?.message ?? 'Could not schedule the auction' }, { status: 500 })
  }

  return NextResponse.json({ auctionId: auction.id, startsAt: auction.starts_at, endsAt: auction.ends_at })
}
