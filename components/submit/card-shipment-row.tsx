'use client'

import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatZAR } from '@/lib/currency'
import { fetchMarketValue } from '@/lib/pricing-client'
import { SportsCardSearch, type SportsCardResult } from '@/components/submit/sports-card-search'
import type { CardEntry, CardType } from '@/lib/submission-types'

interface PokemonSet {
  id: string
  name: string
}

interface PokemonSetCard {
  id: string
  localId: string
  name: string
  image?: string
}

interface PokemonSetDetail {
  releaseDate: string | null
  cards: PokemonSetCard[]
}

const EMPTY_SET_DETAIL: PokemonSetDetail = { releaseDate: null, cards: [] }

/**
 * Set list, brand list, and a given set's detail (card list + release
 * date) are each the same regardless of which row in the shipment asks --
 * module-level caches (shared across every CardShipmentRow instance, not
 * per-row state) so a shipment with many cards fetches each exactly once
 * instead of once per row.
 */
let pokemonSetsPromise: Promise<PokemonSet[]> | null = null
function loadPokemonSets(): Promise<PokemonSet[]> {
  if (!pokemonSetsPromise) {
    pokemonSetsPromise = fetch('https://api.tcgdex.net/v2/en/sets')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: { id: string; name: string }[]) => (Array.isArray(data) ? data.map((s) => ({ id: s.id, name: s.name })) : []))
      .catch((err) => {
        console.error('Could not load Pokemon set list', err)
        return []
      })
  }
  return pokemonSetsPromise
}

let sportsBrandsPromise: Promise<string[]> | null = null
function loadSportsBrands(): Promise<string[]> {
  if (!sportsBrandsPromise) {
    sportsBrandsPromise = fetch('/api/sports-cards/brands')
      .then((res) => (res.ok ? res.json() : { brands: [] }))
      .then((data) => (Array.isArray(data.brands) ? data.brands : []))
      .catch((err) => {
        console.error('Could not load sports card brands', err)
        return []
      })
  }
  return sportsBrandsPromise
}

// The sets-LIST endpoint (loadPokemonSets above) doesn't include
// releaseDate, only {id, name, logo, cardCount} -- confirmed against the
// live API, not assumed. Only the per-set DETAIL endpoint has it, so that's
// what's cached here, and what selectPokemonCard's year auto-populate reads.
const setDetailCache = new Map<string, Promise<PokemonSetDetail>>()
function loadSetDetail(setId: string): Promise<PokemonSetDetail> {
  if (!setDetailCache.has(setId)) {
    setDetailCache.set(
      setId,
      fetch(`https://api.tcgdex.net/v2/en/sets/${setId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { cards?: PokemonSetCard[]; releaseDate?: string } | null) =>
          data ? { releaseDate: data.releaseDate ?? null, cards: data.cards ?? [] } : EMPTY_SET_DETAIL,
        )
        .catch((err) => {
          console.error('Could not load set detail', setId, err)
          return EMPTY_SET_DETAIL
        }),
    )
  }
  return setDetailCache.get(setId)!
}

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
          className="w-full text-left px-3 py-2 text-[13px] flex justify-between gap-2 border-b"
          style={{ borderColor: 'var(--line)', color: 'var(--ink)' }}
        >
          <span className="truncate">{result.name}</span>
          <span className="shrink-0" style={{ color: 'var(--ink-muted)' }}>
            #{result.localId}
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
  const [pokemonSets, setPokemonSets] = useState<PokemonSet[]>([])
  const [sportsBrands, setSportsBrands] = useState<string[]>([])
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null)
  const [setDetail, setSetDetail] = useState<PokemonSetDetail>(EMPTY_SET_DETAIL)
  const [isLoadingSetCards, setIsLoadingSetCards] = useState(false)
  const [focused, setFocused] = useState(false)
  const [selectedCardImage, setSelectedCardImage] = useState<string | null>(null)
  // Locked once a specific card has been picked from search -- Year/Card
  // number become read-only so the data stays exactly what the grader will
  // see, per the submission form's accuracy requirement. "Change" clears it.
  const [isLocked, setIsLocked] = useState(false)

  useEffect(() => {
    loadPokemonSets().then(setPokemonSets)
    loadSportsBrands().then(setSportsBrands)
  }, [])

  useEffect(() => {
    if (!selectedSetId) return
    let cancelled = false
    Promise.resolve().then(() => {
      if (!cancelled) setIsLoadingSetCards(true)
    })
    loadSetDetail(selectedSetId).then((detail) => {
      if (cancelled) return
      setSetDetail(detail)
      setIsLoadingSetCards(false)
    })
    return () => {
      cancelled = true
    }
  }, [selectedSetId])

  const effectiveSetCards = selectedSetId ? setDetail.cards : []

  const pokemonResults =
    card.cardType === 'pokemon' && card.cardName.trim()
      ? effectiveSetCards.filter((c) => c.name.toLowerCase().includes(card.cardName.trim().toLowerCase())).slice(0, 30)
      : []

  function resetSearchState() {
    setIsLocked(false)
    setSelectedCardImage(null)
    onUpdateCard(card.id, {
      cardName: '',
      cardNumber: '',
      year: null,
      externalCardId: null,
      externalSource: null,
      marketValueEstimate: null,
      marketValueSource: null,
    })
  }

  function selectBrandSet(name: string) {
    if (card.cardType === 'pokemon') {
      const set = pokemonSets.find((s) => s.name === name) ?? null
      setSelectedSetId(set?.id ?? null)
    }
    resetSearchState()
    onUpdateCard(card.id, { setName: name })
  }

  async function selectPokemonCard(result: PokemonSetCard) {
    setFocused(false)
    const year = setDetail.releaseDate?.slice(0, 4) ?? card.year
    try {
      const res = await fetch(`https://api.tcgdex.net/v2/en/cards/${result.id}`)
      const fullCard = res.ok ? await res.json() : null
      onUpdateCard(card.id, {
        cardName: fullCard?.name ?? result.name,
        cardNumber: fullCard?.localId ?? result.localId,
        year,
        externalCardId: result.id,
        externalSource: 'tcgdex',
      })
      setSelectedCardImage(fullCard?.image ? `${fullCard.image}/high.png` : null)
    } catch (err) {
      console.error('Card detail fetch error', err)
      onUpdateCard(card.id, {
        cardName: result.name,
        cardNumber: result.localId,
        year,
        externalCardId: result.id,
        externalSource: 'tcgdex',
      })
    }
    setIsLocked(true)
    lookupValue()
  }

  async function lookupValue() {
    if (!card.cardName.trim() || !card.setName.trim()) return
    onUpdateCard(card.id, { isFetchingValue: true })
    const result = await fetchMarketValue(card.cardName, card.setName)
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
    setSelectedSetId(null)
    setIsLocked(false)
    onUpdateCard(card.id, {
      cardType,
      sport: null,
      cardName: '',
      setName: '',
      cardNumber: '',
      year: null,
      externalCardId: null,
      externalSource: null,
      marketValueEstimate: null,
      marketValueSource: null,
    })
  }

  function selectSportsCard(result: SportsCardResult) {
    onUpdateCard(card.id, {
      sport: result.sport,
      cardName: result.playerName,
      cardNumber: result.cardNumber ?? '',
      year: result.year,
      externalCardId: result.id,
      externalSource: 'catalog',
    })
    setIsLocked(true)
    if (result.playerName && card.setName) {
      onUpdateCard(card.id, { isFetchingValue: true })
      fetchMarketValue(result.playerName, card.setName).then((estimate) => {
        onUpdateCard(card.id, {
          isFetchingValue: false,
          marketValueEstimate: estimate?.estimate ?? null,
          marketValueSource: estimate?.source ?? null,
          declaredValue: card.declaredValue || estimate?.estimate || 0,
        })
      })
    }
  }

  const brandSetOptions = card.cardType === 'pokemon' ? pokemonSets.map((s) => s.name) : sportsBrands
  const showPokemonDropdown = card.cardType === 'pokemon' && focused && card.setName && (isLoadingSetCards || pokemonResults.length > 0)

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

      <div className="mb-4">
        <Label className="text-[12.5px]" style={{ color: 'var(--ink-muted)' }}>
          Brand/Set
        </Label>
        <select
          value={card.setName}
          onChange={(e) => selectBrandSet(e.target.value)}
          className="w-full border rounded-[3px] px-3 py-2 text-[14px] bg-transparent"
          style={{ borderColor: 'var(--line)', color: 'var(--ink)' }}
        >
          <option value="" disabled>
            {card.cardType === 'pokemon' ? 'Choose a set…' : 'Choose a brand…'}
          </option>
          {brandSetOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

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
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="relative sm:col-span-2">
            <Label className="text-[12.5px]" style={{ color: 'var(--ink-muted)' }}>
              Search card
            </Label>
            <Input
              value={card.cardName}
              onChange={(e) => onUpdateCard(card.id, { cardName: e.target.value })}
              onFocus={() => setFocused(true)}
              onBlur={() => setTimeout(() => setFocused(false), 150)}
              disabled={!card.setName}
              placeholder={card.setName ? 'Charizard' : 'Choose a set first'}
            />
            {showPokemonDropdown && (
              <ResultsDropdown results={pokemonResults} isSearching={isLoadingSetCards} onSelect={selectPokemonCard} />
            )}
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <Label className="text-[12.5px]" style={{ color: 'var(--ink-muted)' }}>
                Year
              </Label>
              {isLocked && (
                <button
                  type="button"
                  onClick={resetSearchState}
                  className="text-[11px] underline underline-offset-2"
                  style={{ color: 'var(--ink-muted)' }}
                >
                  Change
                </button>
              )}
            </div>
            <Input value={card.year ?? ''} readOnly disabled={!isLocked} placeholder="Select a card" />
          </div>
          <div>
            <Label className="text-[12.5px]" style={{ color: 'var(--ink-muted)' }}>
              Card number
            </Label>
            <Input value={card.cardNumber} readOnly disabled={!isLocked} placeholder="Select a card" />
          </div>
          <div className="sm:col-span-2">
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
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <Label className="text-[12.5px]" style={{ color: 'var(--ink-muted)' }}>
              Search card
            </Label>
            <SportsCardSearch
              value={card.cardName}
              onChange={(value) => onUpdateCard(card.id, { cardName: value })}
              onSelect={selectSportsCard}
              brand={card.setName}
              disabled={!card.setName}
              placeholder={card.setName ? 'Search player, e.g. Messi' : 'Choose a brand first'}
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-baseline justify-between">
                <Label className="text-[12.5px]" style={{ color: 'var(--ink-muted)' }}>
                  Year
                </Label>
                {isLocked && (
                  <button
                    type="button"
                    onClick={resetSearchState}
                    className="text-[11px] underline underline-offset-2"
                    style={{ color: 'var(--ink-muted)' }}
                  >
                    Change
                  </button>
                )}
              </div>
              <Input value={card.year ?? ''} readOnly disabled={!isLocked} placeholder="Select a card" />
            </div>
            <div>
              <Label className="text-[12.5px]" style={{ color: 'var(--ink-muted)' }}>
                Card Number
              </Label>
              <Input value={card.cardNumber} readOnly disabled={!isLocked} placeholder="Select a card" />
            </div>
          </div>
          <div className="max-w-[220px]">
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
        </div>
      )}

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
