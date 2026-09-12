'use client'

import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatZAR } from '@/lib/currency'
import { fetchMarketValue } from '@/lib/pricing-client'
import { SportsCardSearch, type SportsCardResult } from '@/components/submit/sports-card-search'
import { SPORT_OPTIONS } from '@/lib/submission-types'
import type { CardEntry, CardType } from '@/lib/submission-types'
import { searchTcgdexCards, fetchTcgdexSetName, TCGDEX_UNSPECIFIED_SET, type TcgdexCard } from '@/lib/tcgdex'

/**
 * This row used to keep its own copy of the TCGdex search/fetch logic
 * (fetchCards/searchPokemonCards/fetchPokemonSetName) in parallel with
 * lib/tcgdex.ts's near-identical copy -- after the third fix in a row that
 * had to be applied to both places (the "240/193" localId split, then the
 * dropdown thumbnail, then set-name resolution), the duplication's real
 * cost outweighed the smaller diff of keeping them separate. Now imports
 * the shared implementation instead.
 */
type PokemonSetCard = TcgdexCard
const searchPokemonCards = searchTcgdexCards
const fetchPokemonSetName = fetchTcgdexSetName

/**
 * submission_items.set_name is a NOT NULL column, but there's no longer any
 * UI to type or pick a set/brand directly (the Brand/Set dropdown this
 * replaced was the only source for it). Used whenever a card is finalized
 * (blurred, or matched from search) without one -- either the search
 * result itself didn't resolve a set name, or the customer typed a card
 * name that matched nothing and moved on. Admin can correct it at intake.
 */
const UNSPECIFIED_SET = TCGDEX_UNSPECIFIED_SET

const MIN_QUERY_LENGTH = 3
const SEARCH_DEBOUNCE_MS = 500

function ResultsDropdown({
  results,
  isSearching,
  onSelect,
}: {
  results: PokemonSetCard[]
  isSearching: boolean
  onSelect: (result: PokemonSetCard) => void
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
          {/* "low" not "high" -- a dropdown can show up to 30 of these at
              once, and TCGdex's low variant is ~4x smaller (confirmed:
              ~59KB vs ~265KB for the same card) with no visible loss at
              this thumbnail size; /high.png is still what gets used for
              the actual selected-card preview elsewhere in this file. */}
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

interface Props {
  card: CardEntry
  index: number
  canRemove: boolean
  onUpdateCard: (id: string, patch: Partial<CardEntry>) => void
  onRemoveCard: (id: string) => void
}

export function CardShipmentRow({ card, index, canRemove, onUpdateCard, onRemoveCard }: Props) {
  const [pokemonResults, setPokemonResults] = useState<PokemonSetCard[]>([])
  const [isSearchingPokemon, setIsSearchingPokemon] = useState(false)
  const [focused, setFocused] = useState(false)
  const [selectedCardImage, setSelectedCardImage] = useState<string | null>(null)

  useEffect(() => {
    if (card.cardType !== 'pokemon') return
    const query = card.cardName.trim()
    // No setState here for the too-short case (react-hooks/set-state-in-effect
    // flags a synchronous setState directly in an effect body) -- it isn't
    // actually needed: showPokemonDropdown below already gates on
    // pokemonQueryLongEnough independently, so a stale pokemonResults array
    // sitting unused in state while the query is too short never renders.
    if (query.length < MIN_QUERY_LENGTH) return
    let cancelled = false
    const t = setTimeout(async () => {
      setIsSearchingPokemon(true)
      const results = await searchPokemonCards(query)
      if (!cancelled) {
        setPokemonResults(results)
        setIsSearchingPokemon(false)
      }
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [card.cardType, card.cardName])

  const pokemonQueryLongEnough = card.cardName.trim().length >= MIN_QUERY_LENGTH
  // Genuinely searched, came back empty -- expected and fine-to-proceed, not
  // a broken search (components/submit/sports-card-search.tsx has the
  // identical treatment for the sports-card side).
  const pokemonNoResults =
    card.cardType === 'pokemon' && pokemonQueryLongEnough && !isSearchingPokemon && pokemonResults.length === 0

  async function selectPokemonCard(result: PokemonSetCard) {
    setFocused(false)
    setSelectedCardImage(result.image ? `${result.image}/high.png` : null)
    onUpdateCard(card.id, {
      cardName: result.name,
      externalCardId: result.id,
      externalSource: 'tcgdex',
      isFetchingValue: true,
    })
    const setName = await fetchPokemonSetName(result.id)
    onUpdateCard(card.id, { setName })
    const marketResult = await fetchMarketValue(result.name, setName)
    onUpdateCard(card.id, {
      isFetchingValue: false,
      marketValueEstimate: marketResult?.estimate ?? null,
      marketValueSource: marketResult?.source ?? null,
      declaredValue: card.declaredValue || marketResult?.estimate || 0,
    })
  }

  // Backstop for a card that's blurred without ever matching/selecting a
  // search result -- there's no field left to type a set/brand into, so
  // this is also where UNSPECIFIED_SET gets stamped for that path.
  async function lookupValue() {
    if (!card.cardName.trim()) return
    const setName = card.setName.trim() || UNSPECIFIED_SET
    onUpdateCard(card.id, { isFetchingValue: true, ...(card.setName.trim() ? {} : { setName }) })
    const result = await fetchMarketValue(card.cardName, setName)
    onUpdateCard(card.id, {
      isFetchingValue: false,
      marketValueEstimate: result?.estimate ?? null,
      marketValueSource: result?.source ?? null,
      declaredValue: card.declaredValue || result?.estimate || 0,
    })
  }

  function selectCardType(cardType: CardType) {
    if (cardType === card.cardType) return
    // Fields are provider-specific (TCGdex ids vs. a catalog product id), so
    // switching flows starts the row's card fields clean rather than mixing
    // half-Pokemon, half-sports-card state.
    setSelectedCardImage(null)
    setPokemonResults([])
    onUpdateCard(card.id, {
      cardType,
      sport: null,
      cardName: '',
      setName: '',
      externalCardId: null,
      externalSource: null,
      marketValueEstimate: null,
      marketValueSource: null,
    })
  }

  function selectSportsCard(result: SportsCardResult) {
    const setName = result.brandSet?.trim() || UNSPECIFIED_SET
    onUpdateCard(card.id, {
      sport: result.sport,
      cardName: result.playerName,
      setName,
      externalCardId: result.id,
      externalSource: 'catalog',
      isFetchingValue: true,
    })
    fetchMarketValue(result.playerName, setName).then((estimate) => {
      onUpdateCard(card.id, {
        isFetchingValue: false,
        marketValueEstimate: estimate?.estimate ?? null,
        marketValueSource: estimate?.source ?? null,
        declaredValue: card.declaredValue || estimate?.estimate || 0,
      })
    })
  }

  const showPokemonDropdown = card.cardType === 'pokemon' && focused && pokemonQueryLongEnough && (isSearchingPokemon || pokemonResults.length > 0)

  return (
    <div className="border rounded-[3px] p-4" style={{ borderColor: 'var(--line)' }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[12px]" style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink-muted)' }}>
          {String(index + 1).padStart(2, '0')}
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={() => onRemoveCard(card.id)}
            className="text-[12px] underline underline-offset-2"
            style={{ color: 'var(--ink-muted)' }}
          >
            Remove
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-3">
        {(['pokemon', 'sports_card'] as CardType[]).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => selectCardType(type)}
            className="px-3 py-1.5 text-[12.5px] rounded-[3px] border"
            style={{
              borderColor: card.cardType === type ? 'var(--seal)' : 'var(--line)',
              background: card.cardType === type ? 'var(--seal)' : 'transparent',
              color: card.cardType === type ? 'var(--seal-ink)' : 'var(--ink-muted)',
            }}
          >
            {type === 'pokemon' ? 'Pokémon' : 'Sports Cards'}
          </button>
        ))}
      </div>

      {card.cardType === 'sports_card' && (
        <div className="mb-4">
          <Label className="text-[12.5px]" style={{ color: 'var(--ink-muted)' }}>
            Sport
          </Label>
          <select
            value={card.sport ?? ''}
            onChange={(e) => onUpdateCard(card.id, { sport: (e.target.value || null) as CardEntry['sport'] })}
            className="w-full border rounded-[3px] px-3 py-2 text-[14px] bg-transparent"
            style={{ borderColor: 'var(--line)', color: 'var(--ink)' }}
          >
            <option value="" disabled>
              Choose a sport…
            </option>
            {SPORT_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {card.cardType === 'pokemon' && selectedCardImage && (
        <div className="flex justify-center mb-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={selectedCardImage}
            alt={card.cardName}
            className="h-28 rounded border"
            style={{ borderColor: 'var(--line)' }}
          />
        </div>
      )}

      {card.cardType === 'pokemon' ? (
        <div>
          <Label className="text-[12.5px]" style={{ color: 'var(--ink-muted)' }}>
            Search card
          </Label>
          <div className="relative">
            <Input
              value={card.cardName}
              onChange={(e) => onUpdateCard(card.id, { cardName: e.target.value })}
              onFocus={() => setFocused(true)}
              onBlur={() => {
                setTimeout(() => setFocused(false), 150)
                lookupValue()
              }}
              placeholder={`Search by card name or number (e.g. "Charizard 004")`}
              className={pokemonNoResults ? 'pr-9' : undefined}
            />
            {pokemonNoResults && (
              <Check
                className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4"
                style={{ color: '#4ade80' }}
                aria-label="Not in our catalog — your typed entry will be used as-is"
              />
            )}
            {showPokemonDropdown && (
              <ResultsDropdown results={pokemonResults} isSearching={isSearchingPokemon} onSelect={selectPokemonCard} />
            )}
          </div>
          {pokemonNoResults && (
            <p className="text-[12px] mt-1.5" style={{ color: 'var(--ink-muted)' }}>
              Card not found in database. Please type the full card name and details above to proceed.
            </p>
          )}
        </div>
      ) : (
        <div>
          <Label className="text-[12.5px]" style={{ color: 'var(--ink-muted)' }}>
            Search card
          </Label>
          <SportsCardSearch
            value={card.cardName}
            onChange={(value) => onUpdateCard(card.id, { cardName: value })}
            onSelect={selectSportsCard}
            onBlur={lookupValue}
            placeholder="Search by card name or number..."
          />
        </div>
      )}

      <div className="mt-3 max-w-[220px]">
        <Label className="text-[12.5px]" style={{ color: 'var(--ink-muted)' }}>
          Declared value (R)
        </Label>
        <div className="relative">
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[13.5px] pointer-events-none"
            style={{ color: 'var(--ink-muted)' }}
          >
            R
          </span>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={card.declaredValue}
            onChange={(e) => onUpdateCard(card.id, { declaredValue: Number(e.target.value) })}
            className="pl-7"
          />
        </div>
      </div>

      <p className="text-[12.5px] mt-3 min-h-[1.2em]" style={{ color: 'var(--ink-muted)' }}>
        {card.isFetchingValue && 'Checking market value…'}
        {!card.isFetchingValue && card.marketValueEstimate !== null && (
          <>
            Market estimate:{' '}
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatZAR(card.marketValueEstimate)}</span>{' '}
            ({card.marketValueSource})
          </>
        )}
      </p>
    </div>
  )
}
