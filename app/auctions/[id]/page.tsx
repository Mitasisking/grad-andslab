import { notFound } from 'next/navigation'
import { getSupabaseRouteClient } from '@/lib/supabase-route-client'
import { AuctionDetail } from './auction-detail'
import type { AuctionRow, BidRow } from '@/lib/auction-types'

export default async function AuctionPage({ params }: { params: Promise<{ id: string }> }) {
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
