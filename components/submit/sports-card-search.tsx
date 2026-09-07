'use client'

import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import type { Sport } from '@/lib/submission-types'

export interface SportsCardResult {
  id: string
  playerName: string
  year: string | null
  brandSet: string | null
  cardNumber: string | null
}

interface Props {
  sport: Sport
  // Bound directly to the parent's cardName, same as the Pokemon flow's
  // "Card name" field -- typing always registers, whether or not the
  // provider ever returns a matching result (see selectSportsCard in
  // card-shipment-row.tsx for what a click on a result additionally fills in).
  value: string
  onChange: (value: string) => void
  onSelect: (result: SportsCardResult) => void
}

export function SportsCardSearch({ sport, value, onChange, onSelect }: Props) {
  const [results, setResults] = useState<SportsCardResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    const trimmed = value.trim()
    if (!trimmed) {
      setResults([])
      setError(null)
      setIsSearching(false)
      return
    }
    setIsSearching(true)
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/sports-cards/search?sport=${sport}&q=${encodeURIComponent(trimmed)}`)
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
    }, 450)
    return () => clearTimeout(t)
  }, [value, sport])

  const showDropdown = focused && (isSearching || results.length > 0 || error !== null)

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder="Search player, e.g. Messi 2022"
      />
      {showDropdown && (
        <div
          className="absolute left-0 right-0 top-full mt-1 border rounded-[3px] max-h-60 overflow-y-auto z-20"
          style={{ borderColor: 'var(--line)', background: 'var(--paper-raised)' }}
        >
          {isSearching && (
            <p className="text-[12px] px-3 py-2" style={{ color: 'var(--ink-muted)' }}>
              Searching…
            </p>
          )}
          {!isSearching && error && (
            <p className="text-[12px] px-3 py-2" style={{ color: 'var(--danger)' }}>
              {error}
            </p>
          )}
          {!isSearching &&
            !error &&
            results.map((result) => (
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
                  {[result.year, result.brandSet, result.cardNumber && `#${result.cardNumber}`]
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
