'use client'

import { useEffect, useState } from 'react'
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
  /** Scopes the search to one brand (app/api/sports-cards/brands) -- required, per the "filter first" flow. */
  brand: string
  disabled?: boolean
  placeholder?: string
}

export function SportsCardSearch({ value, onChange, onSelect, brand, disabled, placeholder }: Props) {
  const [results, setResults] = useState<SportsCardResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [focused, setFocused] = useState(false)

  const trimmedValue = value.trim()
  const active = Boolean(trimmedValue) && !disabled

  useEffect(() => {
    if (!active) return
    const t = setTimeout(async () => {
      setIsSearching(true)
      try {
        const params = new URLSearchParams({ q: trimmedValue, brand })
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
    }, 350)
    return () => clearTimeout(t)
  }, [active, trimmedValue, brand])

  const displayResults = active ? results : []
  const displayError = active ? error : null
  const displaySearching = active && isSearching
  const showDropdown = focused && (displaySearching || displayResults.length > 0 || displayError !== null)

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        disabled={disabled}
        placeholder={placeholder ?? 'Search player, e.g. Messi'}
      />
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
