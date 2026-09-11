'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CertLink } from '@/components/dashboard/cert-link'

type Franchise = 'pokemon' | 'sports' | 'general'
type RowStatus = 'idle' | 'saving' | 'saved' | 'error'

interface DraftRow {
  certNumber: string
  title: string
  setName: string
  grade: string
  imageUrl: string
  franchise: Franchise
  status: RowStatus
  error?: string
}

const INPUT_CLASS = 'w-full border rounded-[3px] px-2.5 py-1.5 text-[13px] bg-transparent'
const INPUT_STYLE = { borderColor: 'var(--line)', color: 'var(--ink)' }

function parseCertNumbers(raw: string): string[] {
  const seen = new Set<string>()
  for (const piece of raw.split(',')) {
    const trimmed = piece.trim()
    if (trimmed) seen.add(trimmed)
  }
  return Array.from(seen)
}

/**
 * Manual-entry batch tool, not an auto-fetch one -- there's no ACE scraper
 * to fetch from (a real one would mean copying ACE's own slab images/grade
 * data onto our infrastructure without permission, and presenting a cached
 * copy as "verified" is actually less trustworthy than sending a buyer to
 * ACE's own live record -- see components/dashboard/cert-link.tsx). This
 * just removes the one-by-one tedium of app/admin/shop's own "+ New
 * Product" flow for a batch of cert numbers you've already looked up on
 * ACE's real site.
 *
 * Creates every row as is_active: false, price: 0 -- NOT because a R0
 * price hides anything (it doesn't; the shop has no such rule and would
 * show a live "Add to cart" button on a free graded slab), but because
 * is_active is the real mechanism app/admin/shop/shop-admin-dashboard.tsx
 * already uses for "hidden until priced" (it even labels these rows
 * "Hidden from shop" with an Edit button). Price and activate each one
 * from that same dashboard once you've set a real price.
 */
export function BulkAceImport() {
  const [rawInput, setRawInput] = useState('')
  const [rows, setRows] = useState<DraftRow[]>([])
  const [creating, setCreating] = useState(false)

  function handleParse() {
    const certNumbers = parseCertNumbers(rawInput)
    setRows((prev) => {
      const existingByCert = new Map(prev.map((r) => [r.certNumber, r]))
      return certNumbers.map(
        (certNumber) =>
          existingByCert.get(certNumber) ?? {
            certNumber,
            title: '',
            setName: '',
            grade: '',
            imageUrl: '',
            franchise: 'pokemon' as Franchise,
            status: 'idle' as RowStatus,
          },
      )
    })
  }

  function updateRow(certNumber: string, patch: Partial<DraftRow>) {
    setRows((prev) => prev.map((r) => (r.certNumber === certNumber ? { ...r, ...patch } : r)))
  }

  async function handleCreateAll() {
    setCreating(true)

    for (const row of rows) {
      if (!row.title.trim() || row.status === 'saved') continue

      updateRow(row.certNumber, { status: 'saving', error: undefined })

      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: row.title.trim(),
          description: `ACE Cert #${row.certNumber}`,
          category: 'graded',
          franchise: row.franchise,
          price: 0,
          costBasis: null,
          stock: 1,
          images: row.imageUrl.trim() ? [row.imageUrl.trim()] : [],
          isActive: false,
          cardType: row.franchise === 'sports' ? 'sports_card' : 'pokemon',
          setName: row.setName.trim() || null,
          cardNumber: null,
          sport: null,
          brand: null,
          cardVariant: null,
          playerName: null,
          region: 'sa',
        }),
      })

      if (res.ok) {
        updateRow(row.certNumber, { status: 'saved' })
      } else {
        const data = await res.json().catch(() => ({}))
        updateRow(row.certNumber, { status: 'error', error: data.error ?? 'Could not create product.' })
      }
    }

    setCreating(false)
  }

  const readyCount = rows.filter((r) => r.title.trim() && r.status !== 'saved').length
  const savedCount = rows.filter((r) => r.status === 'saved').length

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <Link href="/admin/shop" className="text-[13px] underline underline-offset-2" style={{ color: 'var(--ink-muted)' }}>
        ← Shop inventory
      </Link>

      <p className="text-[13px] mt-4" style={{ color: 'var(--ink-muted)' }}>
        Admin
      </p>
      <h1 className="text-[26px] mt-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
        Bulk ACE Import
      </h1>
      <p className="text-[13.5px] mt-2 max-w-xl" style={{ color: 'var(--ink-muted)' }}>
        Paste ACE cert numbers, then fill in each card&apos;s real details after looking it up on ACE&apos;s own
        verification page (the link on each row opens it). Every row is created hidden (price R0, not shown in the
        shop) — price and activate each one from{' '}
        <Link href="/admin/shop" className="underline underline-offset-2" style={{ color: 'var(--ink)' }}>
          Shop inventory
        </Link>{' '}
        once you know the real price. Include &quot;ACE&quot; in the title so the shop&apos;s existing Grader filter
        picks it up (e.g. &quot;Charizard ex — ACE 10 Gem Mint&quot;).
      </p>

      <div className="mt-8">
        <label className="text-[13px] block mb-2" style={{ color: 'var(--ink)' }}>
          Cert numbers (comma-separated)
        </label>
        <textarea
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
          placeholder="1362208, 1375671, 1362245"
          rows={3}
          className="w-full border rounded-[3px] px-3 py-2 text-[13.5px] bg-transparent"
          style={{ borderColor: 'var(--line)', color: 'var(--ink)' }}
        />
        <button
          type="button"
          onClick={handleParse}
          className="mt-3 px-4 py-2 text-[13.5px] rounded-[3px]"
          style={{ background: 'var(--vault)', color: 'var(--vault-ink)' }}
        >
          Parse cert numbers
        </button>
      </div>

      {rows.length > 0 && (
        <div className="mt-8">
          <div className="flex flex-col gap-4">
            {rows.map((row) => (
              <div key={row.certNumber} className="border rounded-[3px] p-4" style={{ borderColor: 'var(--line)' }}>
                <div className="flex items-center justify-between gap-2">
                  <CertLink grader="ACE" certNumber={row.certNumber} />
                  {row.status === 'saved' && (
                    <span className="text-[12px]" style={{ color: 'var(--seal)' }}>
                      Created
                    </span>
                  )}
                  {row.status === 'saving' && (
                    <span className="text-[12px]" style={{ color: 'var(--ink-muted)' }}>
                      Creating…
                    </span>
                  )}
                </div>

                <div className="grid sm:grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="text-[12px] block mb-1" style={{ color: 'var(--ink-muted)' }}>
                      Title (required)
                    </label>
                    <input
                      value={row.title}
                      onChange={(e) => updateRow(row.certNumber, { title: e.target.value })}
                      disabled={row.status === 'saved'}
                      className={INPUT_CLASS}
                      style={INPUT_STYLE}
                    />
                  </div>
                  <div>
                    <label className="text-[12px] block mb-1" style={{ color: 'var(--ink-muted)' }}>
                      Set name
                    </label>
                    <input
                      value={row.setName}
                      onChange={(e) => updateRow(row.certNumber, { setName: e.target.value })}
                      disabled={row.status === 'saved'}
                      className={INPUT_CLASS}
                      style={INPUT_STYLE}
                    />
                  </div>
                  <div>
                    <label className="text-[12px] block mb-1" style={{ color: 'var(--ink-muted)' }}>
                      Grade
                    </label>
                    <input
                      value={row.grade}
                      onChange={(e) => updateRow(row.certNumber, { grade: e.target.value })}
                      disabled={row.status === 'saved'}
                      placeholder="10 Gem Mint"
                      className={INPUT_CLASS}
                      style={INPUT_STYLE}
                    />
                  </div>
                  <div>
                    <label className="text-[12px] block mb-1" style={{ color: 'var(--ink-muted)' }}>
                      Image URL
                    </label>
                    <input
                      value={row.imageUrl}
                      onChange={(e) => updateRow(row.certNumber, { imageUrl: e.target.value })}
                      disabled={row.status === 'saved'}
                      className={INPUT_CLASS}
                      style={INPUT_STYLE}
                    />
                  </div>
                  <div>
                    <label className="text-[12px] block mb-1" style={{ color: 'var(--ink-muted)' }}>
                      Franchise
                    </label>
                    <select
                      value={row.franchise}
                      onChange={(e) => updateRow(row.certNumber, { franchise: e.target.value as Franchise })}
                      disabled={row.status === 'saved'}
                      className={INPUT_CLASS}
                      style={INPUT_STYLE}
                    >
                      <option value="pokemon">Pokémon</option>
                      <option value="sports">Sports</option>
                      <option value="general">General</option>
                    </select>
                  </div>
                </div>

                {row.error && (
                  <p className="text-[12.5px] mt-2" style={{ color: 'var(--danger)' }}>
                    {row.error}
                  </p>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleCreateAll}
            disabled={creating || readyCount === 0}
            className="mt-6 px-4 py-2 text-[13.5px] rounded-[3px] disabled:opacity-50"
            style={{ background: 'var(--vault)', color: 'var(--vault-ink)' }}
          >
            {creating ? 'Creating…' : `Create ${readyCount} product${readyCount === 1 ? '' : 's'}`}
          </button>
          {savedCount > 0 && (
            <span className="ml-3 text-[13px]" style={{ color: 'var(--ink-muted)' }}>
              {savedCount} created so far
            </span>
          )}
        </div>
      )}
    </main>
  )
}
