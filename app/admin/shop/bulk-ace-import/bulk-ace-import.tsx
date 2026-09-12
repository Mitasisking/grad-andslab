'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { CertLink } from '@/components/dashboard/cert-link'
import { searchTcgdexCards, fetchTcgdexSetName, type TcgdexCard } from '@/lib/tcgdex'

type Franchise = 'pokemon' | 'sports' | 'general'
type RowStatus = 'idle' | 'saving' | 'saved' | 'error'

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
}

/**
 * No verified ACE grading-scale documentation was available, so this list
 * fills in the half-point scale around the examples actually given
 * ("10 Pristine", "10 Gem Mint", "9 Mint", "8.5 NM-Mint+") rather than
 * guessing at ACE's real cutoffs. Adjust directly if ACE's real scale turns
 * out to differ. DEFAULT_GRADE seeds every new row so admins only need to
 * change it for the (rare) card that isn't a straight Gem Mint.
 */
const GRADE_OPTIONS = [
  '10 Pristine',
  '10 Gem Mint',
  '9.5 Mint+',
  '9 Mint',
  '8.5 NM-Mint+',
  '8 NM-Mint',
  '7.5 NM+',
  '7 Near Mint',
  '6.5 EX-Mint+',
  '6 Excellent-Mint',
  '5.5 EX+',
  '5 Excellent',
  '4.5 VG-EX+',
  '4 Very Good-Excellent',
  '3 Very Good',
  '2 Good',
  '1 Poor',
]
const DEFAULT_GRADE = '10 Gem Mint'

const INPUT_CLASS = 'w-full border rounded-[3px] px-2.5 py-1.5 text-[13px] bg-transparent'
const INPUT_STYLE = { borderColor: 'var(--line)', color: 'var(--ink)' }
const MIN_QUERY_LENGTH = 3
const SEARCH_DEBOUNCE_MS = 500

function parseCertNumbers(raw: string): string[] {
  const seen = new Set<string>()
  for (const piece of raw.split(',')) {
    const trimmed = piece.trim()
    if (trimmed) seen.add(trimmed)
  }
  return Array.from(seen)
}

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
          {/* "low" not "high" -- up to 30 of these can render at once, and
              TCGdex's low variant is ~4x smaller with no visible loss at
              this thumbnail size. */}
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

/**
 * Split out as its own component (rather than inline in the .map below) so
 * each row can own its own search/focus state independently -- same reason
 * components/submit/card-shipment-row.tsx is one row per component rather
 * than a single shared search state for the whole list.
 *
 * TCGdex only indexes Pokémon cards, so the search bar only replaces the
 * Title/Set name/Image URL inputs for franchise === 'pokemon' rows; Sports
 * and General rows keep the original manual text inputs, since forcing them
 * through a Pokémon-only search would make it impossible to import anything
 * but Pokémon cards through this tool.
 */
function ImportRow({ row, onChange }: ImportRowProps) {
  const [results, setResults] = useState<TcgdexCard[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [focused, setFocused] = useState(false)
  // Bumped on every selectCard call so a slower, earlier fetchTcgdexSetName
  // can tell it's been superseded and skip applying its (now stale) result --
  // without this, selecting card A then quickly re-selecting card B could
  // have A's set-name fetch resolve last and silently overwrite B's correct
  // set name while the title still shows "B".
  const selectionRef = useRef(0)

  const isPokemon = row.franchise === 'pokemon'
  // Also disabled mid-save, not just once saved: handleCreateAll snapshots
  // each row's fields into the POST body before the request fires, so
  // editing a field while it's in flight never actually changes what gets
  // inserted -- it would just leave the input showing a value the DB
  // doesn't have once the row flips to "saved" and locks.
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
            // Delayed, like components/submit/card-shipment-row.tsx's identical
            // search input -- an immediate setFocused(false) unmounts the
            // dropdown before Tab can move focus into one of its result
            // buttons, making the whole search unreachable by keyboard (the
            // onMouseDown={preventDefault} on each result only guards against
            // a mouse click stealing focus, not against Tab).
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
 * Manual-entry batch tool, not an auto-fetch one -- there's no ACE scraper
 * to fetch from (a real one would mean copying ACE's own slab images/grade
 * data onto our infrastructure without permission, and presenting a cached
 * copy as "verified" is actually less trustworthy than sending a buyer to
 * ACE's own live record -- see components/dashboard/cert-link.tsx). This
 * just removes the one-by-one tedium of app/admin/shop's own "+ New
 * Product" flow for a batch of cert numbers you've already looked up on
 * ACE's real site -- and, for Pokémon rows, the same TCGdex search used in
 * the submission flow (lib/tcgdex.ts) fills in the official title/set/image
 * for you once you find the right card.
 *
 * A row with a real price typed in is created is_active: true immediately;
 * a row left blank is created is_active: false, price 0 instead -- NOT
 * because a R0 price hides anything on its own (it doesn't; the shop has
 * no such rule and would show a live "Add to cart" button on a free graded
 * slab), but because is_active is the real mechanism
 * app/admin/shop/shop-admin-dashboard.tsx already uses for "hidden until
 * priced" (it even labels these rows "Hidden from shop" with an Edit
 * button) -- price and activate those ones later from that same dashboard.
 *
 * products has no grading_company/grader column (confirmed against
 * supabase/migrations -- see components/shop/product-filters.tsx's
 * matchesGrader, which can only ever check the product's title text). This
 * used to just save row.title as-is for Pokémon rows -- the official card
 * name pulled straight from TCGdex, e.g. "Ninetales", never "ACE" -- so
 * every Pokémon card imported through this tool was silently invisible to
 * the shop's own Grader filter despite this page's copy claiming otherwise.
 * "ACE" and the grade are now appended to the saved title in
 * handleCreateAll below, decoupled from the plain card name shown in the
 * search input (appending it directly to the input's own value would also
 * get wiped out on the next keystroke, since typing there resets
 * setName/imageUrl to re-trigger a fresh TCGdex search).
 */
export function BulkAceImport() {
  const [rawInput, setRawInput] = useState('')
  const [rows, setRows] = useState<DraftRow[]>([])
  const [creating, setCreating] = useState(false)
  // The `creating` state disables the Save button, but setCreating(true)
  // doesn't take effect until the next render -- two click/tap events fired
  // back-to-back (fast double-click, or a double-firing touch tap) can both
  // pass the disabled check before either re-render happens, both snapshot
  // the same ready rows, and both POST, creating every row twice. This ref
  // is checked and set synchronously, before any await, so the second call
  // always sees it already true and bails immediately.
  const submittingRef = useRef(false)

  function handleParse() {
    const certNumbers = parseCertNumbers(rawInput)
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
          },
      )
      // A cert number already saved to the database but removed from the
      // raw text on a later parse would otherwise just vanish from this
      // list -- the product it created is still real, so keep showing it
      // ("Created") rather than silently hiding evidence it exists.
      const nextCertNumbers = new Set(certNumbers)
      const keptSaved = prev.filter((r) => r.status === 'saved' && !nextCertNumbers.has(r.certNumber))
      return [...next, ...keptSaved]
    })
  }

  function updateRow(certNumber: string, patch: Partial<DraftRow>) {
    setRows((prev) => prev.map((r) => (r.certNumber === certNumber ? { ...r, ...patch } : r)))
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
      // A real price typed in is what makes the row go live -- price alone
      // never hides anything on its own (the shop has no such rule; a R0
      // active row would show a live "Add to cart" on a free slab), so
      // is_active is set explicitly here rather than inferred from price
      // elsewhere.
      const isActive = price > 0

      return {
        // See this file's top-level doc comment: there's no grader column
        // to set, so "ACE" is baked into the title itself here -- the only
        // thing the shop's Grader filter actually checks.
        title: `${row.title.trim()} — ACE ${row.grade}`,
        description: `ACE Cert #${row.certNumber}${row.grade ? ` — Grade ${row.grade}` : ''}`,
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

    // One request for the whole batch -- app/api/admin/products/batch does a
    // single supabase.insert() across all rows rather than one round trip
    // per row, so a save of 6 cards is 1 INSERT statement, not 6.
    //
    // Wrapped in try/catch/finally: fetch() itself can reject outright (the
    // network drops, DNS fails, a deploy restarts mid-request) rather than
    // resolving with a non-ok response -- without this, that rejection would
    // propagate straight out of handleCreateAll and skip the cleanup below,
    // leaving every row stuck on "Creating..." and the button stuck on
    // "Saving..." forever with no error shown and no way to retry short of a
    // full page reload.
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
        Bulk ACE Import
      </h1>
      <p className="text-[13.5px] mt-2 max-w-xl" style={{ color: 'var(--ink-muted)' }}>
        Paste ACE cert numbers, then for each row search for the card (Pokémon rows pull the official title, set, and
        image straight from TCGdex — Sports/General rows still take manual details), pick a grade, and cross-check
        against ACE&apos;s own verification page (the link on each row opens it) before saving. Type a real price and
        the row goes live immediately; leave it blank and it&apos;s created hidden instead — price and activate it
        later from{' '}
        <Link href="/admin/shop" className="underline underline-offset-2" style={{ color: 'var(--ink)' }}>
          Shop inventory
        </Link>
        . &quot;ACE&quot; and the grade are appended to the saved title automatically so the shop&apos;s existing
        Grader filter picks it up.
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
