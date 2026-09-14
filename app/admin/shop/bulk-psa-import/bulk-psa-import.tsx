'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { CertLink } from '@/components/dashboard/cert-link'
import { searchTcgdexCards, fetchTcgdexSetName, type TcgdexCard } from '@/lib/tcgdex'
import { parsePsaCertNumbers } from '@/lib/psa/cert-verification'

type Franchise = 'pokemon' | 'sports' | 'general'
type RowStatus = 'idle' | 'saving' | 'saved' | 'error'
type VerifyStatus = 'idle' | 'checking' | 'verified' | 'not_found' | 'error'

interface DraftRow {
  certNumber: string
  title: string
  setName: string
  grade: string
  imageUrl: string
  franchise: Franchise
  /** Kept as a string for a controlled input; parsed on save. Blank/0 still creates the row hidden, same as before -- typing a real price here is what makes it go live immediately instead of needing a second trip through Shop inventory's Edit modal. */
  price: string
  status: RowStatus
  error?: string
  verify: VerifyStatus
  verifyMessage?: string
}

/** PSA's real, publicly documented numeric scale -- unlike ACE (see bulk-ace-import.tsx's own doc comment), PSA's grade names are an actual published spec, not a guess. */
const GRADE_OPTIONS = [
  '10 GEM MT',
  '9 MINT',
  '8 NM-MT',
  '7 NM',
  '6 EX-MT',
  '5 EX',
  '4 VG-EX',
  '3 VG',
  '2 GOOD',
  '1.5 FR',
  '1 PR',
  'Authentic',
]
const DEFAULT_GRADE = '10 GEM MT'

const INPUT_CLASS = 'w-full border rounded-[3px] px-2.5 py-1.5 text-[13px] bg-transparent'
const INPUT_STYLE = { borderColor: 'var(--line)', color: 'var(--ink)' }
const MIN_QUERY_LENGTH = 3
const SEARCH_DEBOUNCE_MS = 500

function ResultsDropdown({
  results,
  isSearching,
  onSelect,
}: {
  results: TcgdexCard[]
  isSearching: boolean
  onSelect: (result: TcgdexCard) => void
}) {
  return (
    <div
      className="absolute left-0 right-0 top-full mt-1 border rounded-[3px] max-h-60 overflow-y-auto z-20"
      style={{ borderColor: 'var(--line)', background: 'var(--paper-raised)' }}
    >
      {isSearching && (
        <p className="text-[12px] px-3 py-2" style={{ color: 'var(--ink-muted)' }}>
          Searching…
        </p>
      )}
      {results.map((result) => (
        <button
          key={result.id}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onSelect(result)}
          className="w-full flex items-center gap-2.5 text-left px-3 py-2 text-[13px]"
          style={{ borderColor: 'var(--line)', color: 'var(--ink)' }}
        >
          {result.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`${result.image}/low.png`}
              alt=""
              loading="lazy"
              className="w-8 h-11 object-cover rounded-[2px] shrink-0 border"
              style={{ borderColor: 'var(--line)' }}
              onError={(e) => {
                e.currentTarget.style.visibility = 'hidden'
              }}
            />
          ) : (
            <span
              className="w-8 h-11 rounded-[2px] shrink-0 border"
              style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}
              aria-hidden="true"
            />
          )}
          <span className="min-w-0 truncate">
            {result.name}
            {result.localId && (
              <span className="ml-1.5" style={{ color: 'var(--ink-muted)' }}>
                #{result.localId}
              </span>
            )}
            {result.setName && (
              <span className="block text-[11px] truncate" style={{ color: 'var(--ink-muted)' }}>
                {result.setName}
              </span>
            )}
          </span>
        </button>
      ))}
    </div>
  )
}

interface ImportRowProps {
  row: DraftRow
  onChange: (patch: Partial<DraftRow>) => void
}

/** Split out as its own component so each row owns its own search/focus state independently -- same reasoning as bulk-ace-import.tsx's identical ImportRow. */
function ImportRow({ row, onChange }: ImportRowProps) {
  const [results, setResults] = useState<TcgdexCard[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [focused, setFocused] = useState(false)
  const selectionRef = useRef(0)

  const isPokemon = row.franchise === 'pokemon'
  const disabled = row.status === 'saved' || row.status === 'saving'

  useEffect(() => {
    if (!isPokemon) return
    const query = row.title.trim()
    if (query.length < MIN_QUERY_LENGTH) return
    let cancelled = false
    const t = setTimeout(async () => {
      setIsSearching(true)
      const found = await searchTcgdexCards(query)
      if (!cancelled) {
        setResults(found)
        setIsSearching(false)
      }
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [isPokemon, row.title])

  const queryLongEnough = row.title.trim().length >= MIN_QUERY_LENGTH
  const noResults = isPokemon && focused && queryLongEnough && !isSearching && results.length === 0

  async function selectCard(result: TcgdexCard) {
    const selectionId = ++selectionRef.current
    setFocused(false)
    onChange({
      title: result.name,
      imageUrl: result.image ? `${result.image}/high.png` : '',
    })
    const setName = await fetchTcgdexSetName(result.id)
    if (selectionRef.current === selectionId) onChange({ setName })
  }

  return (
    <div className="grid sm:grid-cols-2 gap-3 mt-3">
      {isPokemon ? (
        <div className="relative sm:col-span-2">
          <label className="text-[12px] block mb-1" style={{ color: 'var(--ink-muted)' }}>
            Card search (required)
          </label>
          <input
            value={row.title}
            onChange={(e) => onChange({ title: e.target.value, setName: '', imageUrl: '' })}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            disabled={disabled}
            placeholder={`Search by card name or number (e.g. "Charizard 004")`}
            className={INPUT_CLASS}
            style={INPUT_STYLE}
          />
          {focused && queryLongEnough && (isSearching || results.length > 0) && (
            <ResultsDropdown results={results} isSearching={isSearching} onSelect={selectCard} />
          )}
          {noResults && (
            <p className="text-[12px] mt-1" style={{ color: 'var(--ink-muted)' }}>
              No TCGdex matches — you can still save with this title typed as-is.
            </p>
          )}
          {row.setName && (
            <p className="text-[12px] mt-1" style={{ color: 'var(--ink-muted)' }}>
              Set: {row.setName}
              {row.imageUrl && ' · image found'}
            </p>
          )}
        </div>
      ) : (
        <>
          <div>
            <label className="text-[12px] block mb-1" style={{ color: 'var(--ink-muted)' }}>
              Title (required)
            </label>
            <input
              value={row.title}
              onChange={(e) => onChange({ title: e.target.value })}
              disabled={disabled}
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
              onChange={(e) => onChange({ setName: e.target.value })}
              disabled={disabled}
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
              onChange={(e) => onChange({ imageUrl: e.target.value })}
              disabled={disabled}
              className={INPUT_CLASS}
              style={INPUT_STYLE}
            />
          </div>
        </>
      )}

      <div>
        <label className="text-[12px] block mb-1" style={{ color: 'var(--ink-muted)' }}>
          Grade
        </label>
        <select
          value={row.grade}
          onChange={(e) => onChange({ grade: e.target.value })}
          disabled={disabled}
          className={INPUT_CLASS}
          style={INPUT_STYLE}
        >
          {GRADE_OPTIONS.map((grade) => (
            <option key={grade} value={grade}>
              {grade}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-[12px] block mb-1" style={{ color: 'var(--ink-muted)' }}>
          Franchise
        </label>
        <select
          value={row.franchise}
          onChange={(e) => onChange({ franchise: e.target.value as Franchise, title: '', setName: '', imageUrl: '' })}
          disabled={disabled}
          className={INPUT_CLASS}
          style={INPUT_STYLE}
        >
          <option value="pokemon">Pokémon</option>
          <option value="sports">Sports</option>
          <option value="general">General</option>
        </select>
      </div>
      <div>
        <label className="text-[12px] block mb-1" style={{ color: 'var(--ink-muted)' }}>
          Price (R) — leave blank to keep hidden
        </label>
        <input
          type="number"
          min={0}
          step="0.01"
          value={row.price}
          onChange={(e) => onChange({ price: e.target.value })}
          disabled={disabled}
          placeholder="0.00"
          className={INPUT_CLASS}
          style={{ ...INPUT_STYLE, fontVariantNumeric: 'tabular-nums' }}
        />
      </div>
    </div>
  )
}

/**
 * Manual-entry batch tool for PSA-graded stock, mirroring bulk-ace-import.tsx
 * and bulk-pcg-import.tsx's own shape and reasoning (no auto-fetch scraper;
 * TCGdex search fills in Pokémon rows; "ACE"/"PCG" baked into the saved
 * title since products has no grader column -- see those files' doc
 * comments for the full rationale, unchanged here for PSA).
 *
 * PSA is the one grader of the three with a real public verification API
 * (see app/api/admin/psa/verify-cert/route.ts), so this importer adds a
 * second, live-lookup layer on top of the same format-check the other two
 * importers already have (lib/psa/cert-verification.ts's 8-10 digit PSA
 * pattern vs. lib/cert-validation.ts's plain-numeric ACE/PCG one) --
 * "Verify" hits PSA's own record for that cert. It's advisory, not a save
 * gate: PSA's API being slow/down/unconfigured (PSA_API_TOKEN unset)
 * shouldn't block an admin who already confirmed the cert by eye on PSA's
 * site, matching the CertLink-first, trust-the-admin philosophy documented
 * in bulk-ace-import.tsx.
 */
export function BulkPsaImport() {
  const [rawInput, setRawInput] = useState('')
  const [rows, setRows] = useState<DraftRow[]>([])
  const [invalidCertNumbers, setInvalidCertNumbers] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  const submittingRef = useRef(false)

  function handleParse() {
    const { valid: certNumbers, invalid } = parsePsaCertNumbers(rawInput)
    setInvalidCertNumbers(invalid)
    setRows((prev) => {
      const existingByCert = new Map(prev.map((r) => [r.certNumber, r]))
      const next = certNumbers.map(
        (certNumber) =>
          existingByCert.get(certNumber) ?? {
            certNumber,
            title: '',
            setName: '',
            grade: DEFAULT_GRADE,
            imageUrl: '',
            franchise: 'pokemon' as Franchise,
            price: '',
            status: 'idle' as RowStatus,
            verify: 'idle' as VerifyStatus,
          },
      )
      const nextCertNumbers = new Set(certNumbers)
      const keptSaved = prev.filter((r) => r.status === 'saved' && !nextCertNumbers.has(r.certNumber))
      return [...next, ...keptSaved]
    })
  }

  function updateRow(certNumber: string, patch: Partial<DraftRow>) {
    setRows((prev) => prev.map((r) => (r.certNumber === certNumber ? { ...r, ...patch } : r)))
  }

  async function handleVerify(certNumber: string) {
    updateRow(certNumber, { verify: 'checking', verifyMessage: undefined })
    try {
      const res = await fetch(`/api/admin/psa/verify-cert?certNumber=${encodeURIComponent(certNumber)}`)
      const data = await res.json().catch(() => ({}))
      if (res.status === 404) {
        updateRow(certNumber, { verify: 'not_found', verifyMessage: data.error ?? 'No PSA cert found.' })
      } else if (!res.ok) {
        const message = data.detail ? `${data.error} ${data.detail}` : (data.error ?? 'Could not verify.')
        updateRow(certNumber, { verify: 'error', verifyMessage: message })
      } else {
        updateRow(certNumber, { verify: 'verified', verifyMessage: undefined })
      }
    } catch {
      updateRow(certNumber, { verify: 'error', verifyMessage: 'Network error — could not reach the server.' })
    }
  }

  async function handleCreateAll() {
    if (submittingRef.current) return
    submittingRef.current = true

    const readyRows = rows.filter((r) => r.title.trim() && r.status !== 'saved')
    if (readyRows.length === 0) {
      submittingRef.current = false
      return
    }

    setCreating(true)
    for (const row of readyRows) {
      updateRow(row.certNumber, { status: 'saving', error: undefined })
    }

    const products = readyRows.map((row) => {
      const parsedPrice = Number(row.price)
      const price = Number.isFinite(parsedPrice) && parsedPrice > 0 ? parsedPrice : 0
      const isActive = price > 0

      return {
        // See this file's top-level doc comment: there's no grader column
        // to set, so "PSA" is baked into the title itself here -- the only
        // thing the shop's Grader filter actually checks.
        title: `${row.title.trim()} — PSA ${row.grade}`,
        description: `PSA Cert #${row.certNumber}${row.grade ? ` — Grade ${row.grade}` : ''}`,
        category: 'graded',
        franchise: row.franchise,
        price,
        costBasis: null,
        stock: 1,
        images: row.imageUrl.trim() ? [row.imageUrl.trim()] : [],
        isActive,
        cardType: row.franchise === 'sports' ? 'sports_card' : 'pokemon',
        setName: row.setName.trim() || null,
        cardNumber: null,
        sport: null,
        brand: null,
        cardVariant: null,
        playerName: null,
        region: 'sa',
      }
    })

    try {
      const res = await fetch('/api/admin/products/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products }),
      })

      if (res.ok) {
        for (const row of readyRows) {
          updateRow(row.certNumber, { status: 'saved' })
        }
      } else {
        const data = await res.json().catch(() => ({}))
        const message = data.error ?? 'Could not create products.'
        for (const row of readyRows) {
          updateRow(row.certNumber, { status: 'error', error: message })
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error — could not reach the server.'
      for (const row of readyRows) {
        updateRow(row.certNumber, { status: 'error', error: message })
      }
    } finally {
      setCreating(false)
      submittingRef.current = false
    }
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
        Bulk PSA Import
      </h1>
      <p className="text-[13.5px] mt-2 max-w-xl" style={{ color: 'var(--ink-muted)' }}>
        Paste PSA cert numbers (8-10 digits), then for each row search for the card (Pokémon rows pull the official
        title, set, and image straight from TCGdex — Sports/General rows still take manual details), pick a grade,
        and hit Verify to check the cert against PSA&apos;s own record before saving. Type a real price and the row
        goes live immediately; leave it blank and it&apos;s created hidden instead — price and activate it later from{' '}
        <Link href="/admin/shop" className="underline underline-offset-2" style={{ color: 'var(--ink)' }}>
          Shop inventory
        </Link>
        . &quot;PSA&quot; and the grade are appended to the saved title automatically so the shop&apos;s existing
        Grader filter picks it up.
      </p>

      <div className="mt-8">
        <label className="text-[13px] block mb-2" style={{ color: 'var(--ink)' }}>
          Cert numbers (comma-separated)
        </label>
        <textarea
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
          placeholder="12345678, 87654321, 45678912"
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
        {invalidCertNumbers.length > 0 && (
          <p className="text-[12.5px] mt-2" style={{ color: 'var(--danger)' }}>
            Invalid format — PSA cert numbers are 8-10 digits:{' '}
            {invalidCertNumbers.map((c) => `"${c}"`).join(', ')}. Not added below.
          </p>
        )}
      </div>

      {rows.length > 0 && (
        <div className="mt-8">
          <div className="flex flex-col gap-4">
            {rows.map((row) => (
              <div key={row.certNumber} className="border rounded-[3px] p-4" style={{ borderColor: 'var(--line)' }}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-3">
                    <CertLink grader="PSA" certNumber={row.certNumber} />
                    <button
                      type="button"
                      onClick={() => handleVerify(row.certNumber)}
                      disabled={row.verify === 'checking'}
                      className="text-[12px] underline underline-offset-2 disabled:opacity-50"
                      style={{ color: 'var(--ink-muted)' }}
                    >
                      {row.verify === 'checking' ? 'Verifying…' : 'Verify'}
                    </button>
                    {row.verify === 'verified' && (
                      <span className="text-[12px]" style={{ color: 'var(--seal)' }}>
                        ✓ Verified with PSA
                      </span>
                    )}
                    {row.verify === 'not_found' && (
                      <span className="text-[12px]" style={{ color: 'var(--danger)' }}>
                        {row.verifyMessage ?? 'No PSA cert found.'}
                      </span>
                    )}
                    {row.verify === 'error' && (
                      <span className="text-[12px]" style={{ color: 'var(--danger)' }}>
                        {row.verifyMessage ?? 'Could not verify.'}
                      </span>
                    )}
                  </div>
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

                <ImportRow row={row} onChange={(patch) => updateRow(row.certNumber, patch)} />

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
            {creating ? 'Saving…' : `Save ${readyCount} to Inventory`}
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
