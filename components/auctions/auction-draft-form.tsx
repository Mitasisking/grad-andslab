'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface ItemWithSubmission {
  id: string
  card_name: string
  set_name: string
  grade_result: number | null
  market_value_estimate: number | null
  declared_value: number
  hi_res_photo_url: string | null
  submissions: { grading_company: string }
}

export function AuctionDraftForm({ item }: { item: ItemWithSubmission }) {
  const router = useRouter()
  const defaultTitle = `${item.card_name} — ${item.submissions.grading_company} ${item.grade_result}`
  const defaultStart = Math.max(item.market_value_estimate ?? item.declared_value ?? 1, 1)

  const [title, setTitle] = useState(defaultTitle)
  const [description, setDescription] = useState(
    `${item.card_name}, ${item.set_name}. Graded ${item.submissions.grading_company} ${item.grade_result}.`,
  )
  const [startingPrice, setStartingPrice] = useState(defaultStart.toFixed(2))
  const [reservePrice, setReservePrice] = useState('')
  const [durationHours, setDurationHours] = useState('72')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    const res = await fetch('/api/auctions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemId: item.id,
        title,
        description,
        startingPrice: Number(startingPrice),
        reservePrice: reservePrice ? Number(reservePrice) : null,
        durationHours: Number(durationHours),
      }),
    })
    const data = await res.json()
    setSubmitting(false)
    if (!res.ok) {
      setError(data.error ?? 'Could not create the listing')
      return
    }
    router.push(`/auctions/${data.auctionId}`)
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <p className="text-[13px]" style={{ color: 'var(--ink-muted)' }}>
        List on auction
      </p>
      <h1 className="text-[26px] mt-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
        {item.card_name}
      </h1>

      {item.hi_res_photo_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.hi_res_photo_url}
          alt={item.card_name}
          className="w-32 h-32 object-cover rounded-[3px] border mt-4"
          style={{ borderColor: 'var(--line)' }}
        />
      )}

      <div className="mt-8 space-y-4">
        <div>
          <label className="text-[12.5px] block mb-1" style={{ color: 'var(--ink-muted)' }}>
            Title
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border rounded-[3px] px-3 py-2 text-[14px] bg-transparent"
            style={{ borderColor: 'var(--line)', color: 'var(--ink)' }}
          />
        </div>
        <div>
          <label className="text-[12.5px] block mb-1" style={{ color: 'var(--ink-muted)' }}>
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full border rounded-[3px] px-3 py-2 text-[14px] bg-transparent"
            style={{ borderColor: 'var(--line)', color: 'var(--ink)' }}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[12.5px] block mb-1" style={{ color: 'var(--ink-muted)' }}>
              Starting price
            </label>
            <input
              type="number"
              min={1}
              step="0.01"
              value={startingPrice}
              onChange={(e) => setStartingPrice(e.target.value)}
              className="w-full border rounded-[3px] px-3 py-2 text-[14px] bg-transparent"
              style={{ borderColor: 'var(--line)', color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}
            />
          </div>
          <div>
            <label className="text-[12.5px] block mb-1" style={{ color: 'var(--ink-muted)' }}>
              Reserve (optional)
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={reservePrice}
              onChange={(e) => setReservePrice(e.target.value)}
              className="w-full border rounded-[3px] px-3 py-2 text-[14px] bg-transparent"
              style={{ borderColor: 'var(--line)', color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}
            />
          </div>
        </div>
        <div>
          <label className="text-[12.5px] block mb-1" style={{ color: 'var(--ink-muted)' }}>
            Duration
          </label>
          <select
            value={durationHours}
            onChange={(e) => setDurationHours(e.target.value)}
            className="w-full border rounded-[3px] px-3 py-2 text-[14px] bg-transparent"
            style={{ borderColor: 'var(--line)', color: 'var(--ink)' }}
          >
            <option value="24">24 hours</option>
            <option value="72">3 days</option>
            <option value="168">7 days</option>
          </select>
        </div>
      </div>

      {error && (
        <p className="text-[13px] mt-4" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting || !title || !startingPrice}
        className="mt-8 w-full px-4 py-3 text-[14px] rounded-[3px]"
        style={{ background: 'var(--vault)', color: 'var(--vault-ink)' }}
      >
        {submitting ? 'Publishing…' : 'Publish listing'}
      </button>
    </main>
  )
}
