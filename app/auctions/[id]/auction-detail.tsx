'use client'

import { useRealtimeAuction } from '@/lib/hooks/use-realtime-auction'
import { CountdownTimer } from '@/components/auctions/countdown-timer'
import { BidForm } from '@/components/auctions/bid-form'
import { BidHistory } from '@/components/auctions/bid-history'
import type { AuctionRow, BidRow } from '@/lib/auction-types'
import { formatZAR } from '@/lib/currency'

interface Props {
  initialAuction: AuctionRow
  initialBids: BidRow[]
}

export function AuctionDetail({ initialAuction, initialBids }: Props) {
  const { auction, bids } = useRealtimeAuction(initialAuction, initialBids)

  const reserveMet =
    auction.reserve_price === null ||
    (auction.current_high_bid !== null && auction.current_high_bid >= auction.reserve_price)

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="grid sm:grid-cols-2 gap-8">
        <div
          className="aspect-square rounded-[3px] overflow-hidden border"
          style={{ borderColor: 'var(--line)', background: 'var(--paper-raised)' }}
        >
          {auction.images[0] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={auction.images[0]} alt={auction.title} className="w-full h-full object-cover" />
          )}
        </div>

        <div>
          <p className="text-[13px]" style={{ color: 'var(--ink-muted)' }}>
            {auction.status === 'extended' ? 'Extended — final bids coming in' : 'Live auction'}
          </p>
          <h1 className="text-[24px] mt-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
            {auction.title}
          </h1>

          <div className="flex items-baseline justify-between mt-6">
            <div>
              <p className="text-[12.5px]" style={{ color: 'var(--ink-muted)' }}>
                Current bid
              </p>
              <p className="text-[26px] mt-0.5" style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>
                {formatZAR(auction.current_high_bid ?? auction.starting_price)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[12.5px]" style={{ color: 'var(--ink-muted)' }}>
                Ends in
              </p>
              <CountdownTimer endsAt={auction.ends_at} />
            </div>
          </div>

          {auction.reserve_price !== null && (
            <p className="text-[12.5px] mt-2" style={{ color: reserveMet ? 'var(--seal)' : 'var(--ink-muted)' }}>
              {reserveMet ? 'Reserve met' : 'Reserve not yet met'}
            </p>
          )}

          <div className="mt-6">
            <BidForm auction={auction} onPlaced={() => {}} />
          </div>
        </div>
      </div>

      {auction.description && (
        <p className="text-[14px] mt-10 leading-relaxed max-w-xl" style={{ color: 'var(--ink-muted)' }}>
          {auction.description}
        </p>
      )}

      <BidHistory bids={bids} />
    </main>
  )
}
