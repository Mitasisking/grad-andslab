'use client'

import { useState } from 'react'
import { StripePaymentForm } from '@/components/submit/stripe-payment-form'
import type { AuctionRow } from '@/lib/auction-types'
import { formatZAR } from '@/lib/currency'

interface Props {
  auction: AuctionRow
  onPlaced: () => void
}

export function BidForm({ auction, onPlaced }: Props) {
  const floor = auction.current_high_bid
    ? Number(auction.current_high_bid) + Number(auction.bid_increment)
    : Number(auction.starting_price)

  const [amount, setAmount] = useState(floor.toFixed(2))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)

  const isEnded = auction.status === 'closed' || new Date(auction.ends_at) <= new Date()

  async function placeBid() {
    setSubmitting(true)
    setError(null)
    const res = await fetch(`/api/auctions/${auction.id}/bid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: Number(amount) }),
    })
    const data = await res.json()
    setSubmitting(false)

    if (!res.ok) {
      setError(data.error ?? 'Could not place bid')
      return
    }

    if (data.requiresAction && data.clientSecret) {
      setClientSecret(data.clientSecret)
      return
    }

    onPlaced()
  }

  if (isEnded) {
    return (
      <p className="text-[14px]" style={{ color: 'var(--ink-muted)' }}>
        This auction has ended.
      </p>
    )
  }

  if (clientSecret) {
    return (
      <div>
        <p className="text-[13px] mb-3" style={{ color: 'var(--ink-muted)' }}>
          Confirm your card to place a hold for this bid — you&apos;re only charged if you win.
        </p>
        <StripePaymentForm
          clientSecret={clientSecret}
          onSuccess={() => {
            setClientSecret(null)
            onPlaced()
          }}
        />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="text-[15px]" style={{ color: 'var(--ink)' }}>
          R
        </span>
        <input
          type="number"
          min={floor}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="flex-1 border rounded-[3px] px-3 py-2 text-[15px] bg-transparent"
          style={{ borderColor: 'var(--line)', color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}
        />
        <button
          type="button"
          onClick={placeBid}
          disabled={submitting || Number(amount) < floor}
          className="px-4 py-2 text-[13.5px] rounded-[3px] shrink-0"
          style={{ background: 'var(--seal)', color: 'var(--seal-ink)' }}
        >
          {submitting ? 'Placing…' : 'Place bid'}
        </button>
      </div>
      <p className="text-[12.5px] mt-2" style={{ color: 'var(--ink-muted)' }}>
        Minimum bid: {formatZAR(floor)}. Your card is only charged if you win — this places a hold.
      </p>
      {error && (
        <p className="text-[13px] mt-2" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}
    </div>
  )
}
