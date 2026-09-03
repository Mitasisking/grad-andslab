import type { BidRow } from '@/lib/auction-types'

interface Props {
  bids: BidRow[]
}

/**
 * Public bid list. BidRow (lib/auction-types.ts) carries only bidder_id —
 * there's no evidenced profiles join for a display name anywhere this was
 * queried — so each row is labeled with a short, stable, pseudonymous tag
 * derived from that id rather than guessing at a name field that isn't in
 * the schema.
 */
export function BidHistory({ bids }: Props) {
  return (
    <div className="mt-10">
      <h2 className="text-[16px]" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
        Bid history
      </h2>

      {bids.length === 0 ? (
        <p className="text-[13.5px] mt-3" style={{ color: 'var(--ink-muted)' }}>
          No bids yet.
        </p>
      ) : (
        <div className="flex flex-col mt-3 border-t" style={{ borderColor: 'var(--line)' }}>
          {bids.map((bid) => (
            <div
              key={bid.id}
              className="flex items-center justify-between py-3 border-b"
              style={{ borderColor: 'var(--line)' }}
            >
              <span className="text-[14px]" style={{ color: 'var(--ink)' }}>
                Bidder #{bid.bidder_id.slice(0, 6)}
              </span>
              <div className="text-right">
                <span className="text-[14px]" style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>
                  ${bid.amount.toFixed(2)}
                </span>
                <span className="text-[12px] block mt-0.5" style={{ color: 'var(--ink-muted)' }}>
                  {new Date(bid.created_at).toLocaleString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
