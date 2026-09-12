import Link from 'next/link'
import type { Metadata } from 'next'
import { getSupabaseRouteClient } from '@/lib/supabase-route-client'
import { formatZAR, formatGBP, formatUSD } from '@/lib/currency'
import { getLatestGbpZarRate, zarToGbp, gbpToZar, type ExchangeRate } from '@/lib/pricing/exchange-rate'
import { CountdownTimer } from '@/components/auctions/countdown-timer'
import type { AuctionRow } from '@/lib/auction-types'
import type { ProductRegion } from '@/lib/shop/product-type'

interface ComingSoonProduct {
  id: string
  title: string
  images: string[]
  price: number
  region: ProductRegion
}

/**
 * ZAR-primary-with-GBP-in-brackets, as asked for -- but only where a real
 * rate actually makes that honest: this app's only live exchange-rate
 * source is GBP<->ZAR (lib/pricing/exchange-rate.ts), so a `region: 'sa'`
 * product's native ZAR price gets a converted GBP figure alongside it, and
 * a `region: 'uk'` product's native GBP price gets converted the other way
 * for the ZAR-primary figure. A `region: 'usa'` product has no USD->ZAR or
 * USD->GBP rate anywhere in this codebase, so it shows its real native USD
 * price rather than a fabricated conversion (same reasoning
 * app/admin/trends/trends-dashboard.tsx already documents for its own
 * raw/graded estimates).
 */
function formatAuctionPrice(
  price: number,
  region: ProductRegion,
  rate: ExchangeRate | null,
): { primary: string; bracket: string | null } {
  if (region === 'uk') {
    if (!rate) return { primary: formatGBP(price), bracket: null }
    return { primary: formatZAR(gbpToZar(price, rate)), bracket: formatGBP(price) }
  }
  if (region === 'sa') {
    if (!rate) return { primary: formatZAR(price), bracket: null }
    return { primary: formatZAR(price), bracket: formatGBP(zarToGbp(price, rate)) }
  }
  return { primary: formatUSD(price), bracket: null }
}

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

  const [{ data }, { data: comingSoonData, error: comingSoonError }, rate] = await Promise.all([
    supabase.from('auctions').select(LISTING_COLUMNS).in('status', ['active', 'extended']).order('ends_at', { ascending: true }),
    // Strictly separate from the shop by construction, not just by this
    // query -- is_auction products are excluded from every shop-facing
    // query at the source (app/shop/page.tsx, lib/shop/featured-products.ts),
    // so a card can never be purchasable there and listed here at once.
    supabase
      .from('products')
      .select('id, title, images, price, region')
      .eq('is_auction', true)
      .order('created_at', { ascending: false }),
    getLatestGbpZarRate(),
  ])

  if (comingSoonError) {
    console.error('Auctions "Coming soon" products query failed', comingSoonError.message)
  }

  const auctions = (data ?? []) as unknown as Pick<
    AuctionRow,
    'id' | 'title' | 'description' | 'images' | 'starting_price' | 'current_high_bid' | 'ends_at' | 'status'
  >[]
  const comingSoonProducts = (comingSoonData ?? []) as ComingSoonProduct[]

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
            Cuppa&apos;s Cards Auctions
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

        {comingSoonProducts.length > 0 && (
          <div className="mt-16 pt-12 border-t" style={{ borderColor: 'var(--line)' }}>
            <p className="text-[13px]" style={{ color: 'var(--ink-muted)' }}>
              Coming soon
            </p>
            <h2
              className="font-[family-name:var(--font-display)] text-[26px] leading-[1.1] mt-1"
              style={{ color: 'var(--ink)' }}
            >
              Staged for auction
            </h2>
            <p className="text-[14px] mt-2 max-w-xl leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
              These slabs are set aside for an upcoming auction and aren&apos;t available in the shop. Bidding opens
              here once each one goes live.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
              {comingSoonProducts.map((product) => {
                const { primary, bracket } = formatAuctionPrice(product.price, product.region, rate)
                return (
                  <div
                    key={product.id}
                    className="border rounded-[3px] overflow-hidden"
                    style={{ borderColor: 'var(--line)', background: 'var(--paper-raised)' }}
                  >
                    <div className="aspect-square flex items-center justify-center" style={{ background: 'var(--paper)' }}>
                      {product.images[0] && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product.images[0]}
                          alt={product.title}
                          className="w-full h-full object-contain p-4"
                        />
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="text-[15px] line-clamp-2" style={{ color: 'var(--ink)' }}>
                        {product.title}
                      </h3>
                      <div className="flex items-baseline justify-between mt-3">
                        <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>
                          {primary}
                          {bracket && (
                            <span className="ml-1.5 text-[12.5px]" style={{ color: 'var(--ink-muted)' }}>
                              ({bracket})
                            </span>
                          )}
                        </span>
                      </div>
                      <span
                        className="mt-3 inline-flex w-full items-center justify-center px-3 py-1.5 text-[12.5px] rounded-[3px] cursor-not-allowed"
                        style={{ background: 'var(--paper)', color: 'var(--ink-muted)', border: '1px solid var(--line)' }}
                        aria-disabled="true"
                      >
                        Auction Coming Soon
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
