import { notFound } from 'next/navigation'
import { getSupabaseRouteClient } from '@/lib/supabase-route-client'
import { AuctionDetail } from './auction-detail'
import type { AuctionRow, BidRow } from '@/lib/auction-types'

export default async function AuctionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await getSupabaseRouteClient()

  const { data: auction } = await supabase.from('auctions').select('*').eq('id', id).single()
  if (!auction) notFound()

  // Explicit column list, not select('*') — anon/authenticated no longer
  // have SELECT on stripe_payment_intent_id as of
  // supabase/migrations/0010_rls_hardening_low.sql, so select('*') would
  // error for this session-scoped client.
  const { data: bids } = await supabase
    .from('bids')
    .select('id, auction_id, bidder_id, amount, payment_status, created_at')
    .eq('auction_id', id)
    .order('created_at', { ascending: false })
    .limit(50)

  return <AuctionDetail initialAuction={auction as AuctionRow} initialBids={(bids ?? []) as BidRow[]} />
}
