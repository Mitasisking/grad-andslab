import { notFound, redirect } from 'next/navigation'
import { getSupabaseRouteClient } from '@/lib/supabase-route-client'
import { AuctionDetail } from './auction-detail'
import type { AuctionRow, BidRow } from '@/lib/auction-types'

export default async function AuctionPage({ params }: { params: Promise<{ id: string }> }) {
  // Live Auctions is shelved for a future Phase 2 -- see app/auctions/page.tsx.
  // Widened to `boolean` (not the literal `false`) so TypeScript can't prove
  // this branch always taken and mark the rest of the function unreachable --
  // that would silently drop the null-narrowing the code below relies on.
  const AUCTIONS_ENABLED = false as boolean
  if (!AUCTIONS_ENABLED) redirect('/shop')

  const { id } = await params
  const supabase = await getSupabaseRouteClient()

  const [{ data: auction }, { data: userData }] = await Promise.all([
    supabase.from('auctions').select('*').eq('id', id).single(),
    supabase.auth.getUser(),
  ])
  if (!auction) notFound()

  const { data: bids } = await supabase
    .from('bids')
    .select('id, auction_id, bidder_id, amount, payment_status, created_at')
    .eq('auction_id', id)
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <AuctionDetail
      initialAuction={auction as AuctionRow}
      initialBids={(bids ?? []) as BidRow[]}
      currentUserId={userData.user?.id ?? null}
    />
  )
}
