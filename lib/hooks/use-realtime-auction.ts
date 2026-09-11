'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { AuctionRow, BidRow } from '@/lib/auction-types'

/**
 * Keeps one auction's price/status and its bid list live: the initial
 * server-fetched data renders immediately (no loading flash), then this
 * subscribes to Postgres changes scoped to that one auction id — an UPDATE
 * on `auctions` (new high bid landing, status flipping to extended/closed)
 * and INSERTs on `bids` (a bid placed, per
 * app/api/auctions/[id]/bid/route.ts). Requires Realtime enabled on both
 * tables (see app/auctions/README.md's "Enable Realtime" step).
 */
export function useRealtimeAuction(initialAuction: AuctionRow, initialBids: BidRow[]) {
  const [auction, setAuction] = useState(initialAuction)
  const [bids, setBids] = useState(initialBids)

  useEffect(() => {
    setAuction(initialAuction)
  }, [initialAuction])

  useEffect(() => {
    setBids(initialBids)
  }, [initialBids])

  useEffect(() => {
    const auctionId = initialAuction.id

    const channel = supabase
      .channel(`auction:${auctionId}`)
      .on<AuctionRow>(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'auctions', filter: `id=eq.${auctionId}` },
        (payload) => setAuction(payload.new),
      )
      .on<BidRow>(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bids',
          filter: `auction_id=eq.${auctionId}`,
          // Matches BidRow exactly.
          select: ['id', 'auction_id', 'bidder_id', 'amount', 'payment_status', 'created_at'],
        },
        // Bid history renders most-recent-first, matching the ordering used
        // for the initial fetch (app/auctions/[id]/page.tsx's own
        // `.order('created_at', { ascending: false })` lookup).
        (payload) => setBids((prev) => [payload.new, ...prev]),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [initialAuction.id])

  return { auction, bids }
}
