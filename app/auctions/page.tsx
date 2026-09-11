import Link from 'next/link'
import type { Metadata } from 'next'
import { getSupabaseRouteClient } from '@/lib/supabase-route-client'
import { formatZAR } from '@/lib/currency'
import { CountdownTimer } from '@/components/auctions/countdown-timer'
import type { AuctionRow } from '@/lib/auction-types'

export const metadata: Metadata = {
  title: 'Live Auctions',
  description: 'Bid on graded slabs and high-end collector pieces.',
}

const LISTING_COLUMNS = 'id, title, description, images, starting_price, current_high_bid, ends_at, status'

/**
 * Was previously a fully broken page: it read/wrote current_bid/
 * highest_bidder/image_url, columns that never actually existed in
 * production (confirmed live -- see supabase/migrations/
 * 0044_reconcile_auctions_schema.sql's header for the full drift this
 * closed), and placed "bids" via a raw client-side .update() straight to
 * the table -- no payment, and (before that same migration) exploiting a
 * live RLS hole that let any authenticated user rewrite any column on any
 * auction. Real bidding already exists and works correctly at
 * app/auctions/[id] (BidForm, anti-sniping, Payfast invoice on close) --
 * this page's only job now is to list what's active and link there.
 */
export default async function AuctionsPage() {
  const supabase = await getSupabaseRouteClient()

  const { data } = await supabase
    .from('auctions')
    .select(LISTING_COLUMNS)
    .in('status', ['active', 'extended'])
    .order('ends_at', { ascending: true })

  const auctions = (data ?? []) as unknown as Pick<
    AuctionRow,
    'id' | 'title' | 'description' | 'images' | 'starting_price' | 'current_high_bid' | 'ends_at' | 'status'
  >[]

  return (
    <main className="min-h-screen" style={{ background: 'var(--paper)' }}>
      <div className="max-w-6xl mx-auto px-6 py-12">
        <header className="mb-10 max-w-xl">
          <p className="text-[13px]" style={{ color: 'var(--ink-muted)' }}>
            Live bidding
          </p>
          <h1
            className="font-[family-name:var(--font-display)] text-[34px] lg:text-[42px] leading-[1.05] mt-2"
            style={{ color: 'var(--ink)' }}
          >
            Cuppa Cards Auctions
          </h1>
          <p className="text-[15px] mt-4 leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
            Bid on graded slabs and high-end collector pieces. Bidding is free — only the winner pays, via
            Payfast, once the auction closes.
          </p>
        </header>

        {auctions.length === 0 ? (
          <div className="text-center py-20 border rounded-[3px]" style={{ borderColor: 'var(--line)' }}>
            <p style={{ color: 'var(--ink-muted)' }}>No active auctions right now. Check back soon.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Already ordered by ends_at ascending, so index 0 is always the
                one ending soonest -- highlighted rather than recomputed. */}
            {auctions.map((auction, index) => {
              const endingSoonest = index === 0
              return (
                <Link
                  key={auction.id}
                  href={`/auctions/${auction.id}`}
                  className="block border rounded-[3px] overflow-hidden transition hover:border-[var(--seal)]"
                  style={{
                    borderColor: endingSoonest ? 'var(--seal)' : 'var(--line)',
                    borderWidth: endingSoonest ? 2 : 1,
                    background: 'var(--paper-raised)',
                  }}
                >
                  <div className="aspect-square overflow-hidden relative" style={{ background: 'var(--paper)' }}>
                    {auction.images[0] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={auction.images[0]} alt={auction.title} className="w-full h-full object-cover" />
                    )}
                    {endingSoonest && (
                      <span
                        className="absolute top-2 left-2 px-2 py-1 text-[11px] uppercase tracking-wide rounded-[3px]"
                        style={{ background: 'var(--seal)', color: 'var(--seal-ink)' }}
                      >
                        Ending soonest
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="text-[12px] uppercase tracking-wide" style={{ color: 'var(--seal)' }}>
                      {auction.status === 'extended' ? 'Extended — final bids coming in' : 'Live'}
                    </p>
                    <h3 className="text-[15px] mt-1 line-clamp-2" style={{ color: 'var(--ink)' }}>
                      {auction.title}
                    </h3>
                    <div className="flex items-baseline justify-between mt-3">
                      <span className="text-[12px]" style={{ color: 'var(--ink-muted)' }}>
                        Current bid
                      </span>
                      <span
                        className="text-[18px]"
                        style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}
                      >
                        {formatZAR(auction.current_high_bid ?? auction.starting_price)}
                      </span>
                    </div>
                    {endingSoonest && (
                      <div className="flex items-baseline justify-between mt-2 pt-2 border-t" style={{ borderColor: 'var(--line)' }}>
                        <span className="text-[12px]" style={{ color: 'var(--ink-muted)' }}>
                          Ends in
                        </span>
                        <CountdownTimer endsAt={auction.ends_at} />
                      </div>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
