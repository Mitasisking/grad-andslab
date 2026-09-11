'use client'

import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { SPORT_OPTIONS } from '@/lib/submission-types'
import type { Sport } from '@/lib/submission-types'

export interface SportsCardResult {
  id: string
  // Which of our five supported sports this result came from -- the search
  // has no sport picker of its own, so this is how card-shipment-row.tsx's
  // selectSportsCard fills in the card's required sport field. See
  // app/api/sports-cards/search/route.ts for why this is real (the sport we
  // queried the provider under), not something read back from the provider.
  sport: Sport
  playerName: string
  year: string | null
  brandSet: string | null
  cardNumber: string | null
}

const SPORT_LABEL: Record<Sport, string> = Object.fromEntries(
  SPORT_OPTIONS.map((s) => [s.value, s.label]),
) as Record<Sport, string>

interface Props {
  // Bound directly to the parent's cardName, same as the Pokemon flow's
  // search field -- typing always registers, whether or not the catalog
  // has a matching result (see selectSportsCard in card-shipment-row.tsx
  // for what a click on a result additionally fills in).
  value: string
  onChange: (value: string) => void
  onSelect: (result: SportsCardResult) => void
  /** Optionally scopes the search to one brand (app/api/sports-cards/brands) -- omitted by card-shipment-row.tsx since removing the Brand/Set picker made every search global; kept for any caller that still wants to narrow it. */
  brand?: string
  disabled?: boolean
  placeholder?: string
  /** Fires when the input blurs, whether or not a result was picked -- card-shipment-row.tsx uses this to finalize a free-typed (no result selected) card. */
  onBlur?: () => void
}

export function SportsCardSearch({ value, onChange, onSelect, brand, disabled, placeholder, onBlur }: Props) {
  const [results, setResults] = useState<SportsCardResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [focused, setFocused] = useState(false)

  const trimmedValue = value.trim()
  // Matches the Pokemon search's own floor (components/submit/card-shipment-row.tsx)
  // -- below 3 characters the catalog match is too broad to be useful and
  // just churns requests on every keystroke.
  const active = trimmedValue.length >= 3 && !disabled

  useEffect(() => {
    if (!active) return
    const t = setTimeout(async () => {
      setIsSearching(true)
      try {
        const params = new URLSearchParams({ q: trimmedValue })
        if (brand) params.set('brand', brand)
        const res = await fetch(`/api/sports-cards/search?${params}`)
        const data = await res.json()
        if (!res.ok) {
          setError(data.error ?? 'Search failed. Please try again.')
          setResults([])
        } else {
          setError(null)
          setResults(data.results)
        }
      } catch {
        setError('Search failed. Please try again.')
        setResults([])
      } finally {
        setIsSearching(false)
      }
    }, 500)
    return () => clearTimeout(t)
  }, [active, trimmedValue, brand])

  const displayResults = active ? results : []
  const displayError = active ? error : null
  const displaySearching = active && isSearching
  // Genuinely searched, came back empty, no error -- our own 50-row sports
  // catalog is nowhere near a full card database, so this is the expected,
  // fine-to-proceed case, not a broken search. See card-shipment-row.tsx's
  // Pokemon-side equivalent for the same treatment.
  const noResults = active && !displaySearching && !displayError && displayResults.length === 0
  const showDropdown = focused && (displaySearching || displayResults.length > 0 || displayError !== null)

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setTimeout(() => setFocused(false), 150)
          onBlur?.()
        }}
        disabled={disabled}
        placeholder={placeholder ?? 'Search player, e.g. Messi'}
        className={noResults ? 'pr-9' : undefined}
      />
      {noResults && (
        <Check
          className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4"
          style={{ color: '#4ade80' }}
          aria-label="Not in our catalog — your typed entry will be used as-is"
        />
      )}
      {noResults && (
        <p className="text-[12px] mt-1.5" style={{ color: 'var(--ink-muted)' }}>
          Card not found in database. Please type the full card name and details above to proceed.
        </p>
      )}
      {showDropdown && (
        <div
          className="absolute left-0 right-0 top-full mt-1 border rounded-[3px] max-h-60 overflow-y-auto z-20"
          style={{ borderColor: 'var(--line)', background: 'var(--paper-raised)' }}
        >
          {displaySearching && (
            <p className="text-[12px] px-3 py-2" style={{ color: 'var(--ink-muted)' }}>
              Searching…
            </p>
          )}
          {!displaySearching && displayError && (
            <p className="text-[12px] px-3 py-2" style={{ color: 'var(--danger)' }}>
              {displayError}
            </p>
          )}
          {!displaySearching &&
            !displayError &&
            displayResults.map((result) => (
              <button
                key={result.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelect(result)
                  setFocused(false)
                }}
                className="w-full text-left px-3 py-2 text-[13px] flex justify-between gap-2 border-b"
                style={{ borderColor: 'var(--line)', color: 'var(--ink)' }}
              >
                <span className="truncate">{result.playerName}</span>
                <span className="shrink-0" style={{ color: 'var(--ink-muted)' }}>
                  {[SPORT_LABEL[result.sport], result.year, result.brandSet, result.cardNumber && `#${result.cardNumber}`]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  )
}
