'use client'

import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { fetchMarketValue } from '@/lib/pricing-client'
import type { CardEntry } from '@/lib/submission-types'

interface TCGdexSearchResult {
  id: string
  localId: string
  name: string
  lang: 'en' | 'ja' | 'ja-translated'
}

async function parseResults(res: Response | null, lang: 'en' | 'ja'): Promise<TCGdexSearchResult[]> {
  if (!res || !res.ok) return []
  const data = await res.json()
  return Array.isArray(data) ? data.map((c: { id: string; localId: string; name: string }) => ({ ...c, lang })) : []
}

function dedupeById(cards: TCGdexSearchResult[]): TCGdexSearchResult[] {
  return Array.from(new Map(cards.map((c) => [c.id, c])).values())
}

/**
 * Live TCGdex search for the card name/number fields below, ported from the
 * pre-rebuild dashboard's single card-add form (app/dashboard/page.tsx,
 * replaced with a link to /submit earlier this session) -- same four-way
 * EN/JA name+localId search with a translation pass for Japanese-exclusive
 * results, just scoped to one row in a dynamic card list instead of a
 * single add-one-card form.
 */
async function searchTcgdexCards(name: string, number: string): Promise<TCGdexSearchResult[]> {
  if (!name && !number) return []
  const encodedName = encodeURIComponent(name)
  const encodedNumber = encodeURIComponent(number)

  const [nameEnRes, nameJaRes, idEnRes, idJaRes] = await Promise.all([
    name ? fetch(`https://api.tcgdex.net/v2/en/cards?name=${encodedName}`) : Promise.resolve(null),
    name ? fetch(`https://api.tcgdex.net/v2/ja/cards?name=${encodedName}`) : Promise.resolve(null),
    number ? fetch(`https://api.tcgdex.net/v2/en/cards?localId=${encodedNumber}`) : Promise.resolve(null),
    number ? fetch(`https://api.tcgdex.net/v2/ja/cards?localId=${encodedNumber}`) : Promise.resolve(null),
  ])

  const [nameEn, nameJa, idEn, idJa] = await Promise.all([
    parseResults(nameEnRes, 'en'),
    parseResults(nameJaRes, 'ja'),
    parseResults(idEnRes, 'en'),
    parseResults(idJaRes, 'ja'),
  ])

  const uniqueEn = dedupeById([...nameEn, ...idEn])
  const uniqueJa = dedupeById([...nameJa, ...idJa])
  const enIds = new Set(uniqueEn.map((c) => c.id))
  const exclusiveJa = uniqueJa.filter((c) => !enIds.has(c.id)).slice(0, 15)

  const translatedJa = await Promise.all(
    exclusiveJa.map(async (card) => {
      try {
        const res = await fetch(`https://api.tcgdex.net/v2/en/cards/${card.id}`)
        if (res.ok) {
          const fullEn = await res.json()
          if (fullEn.name) return { ...card, name: fullEn.name, lang: 'ja-translated' as const }
        }
        const translateRes = await fetch(
          `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=en&dt=t&q=${encodeURIComponent(card.name)}`,
        )
        if (translateRes.ok) {
          const transData = await translateRes.json()
          if (transData?.[0]?.[0]?.[0]) return { ...card, name: transData[0][0][0], lang: 'ja-translated' as const }
        }
      } catch (err) {
        console.error('Translation fetch failed', err)
      }
      return card
    }),
  )

  return [...uniqueEn.slice(0, 30), ...translatedJa]
}

function ResultsDropdown({
  results,
  isSearching,
  onSelect,
}: {
  results: TCGdexSearchResult[]
  isSearching: boolean
  onSelect: (result: TCGdexSearchResult) => void
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
          key={`${result.id}-${result.lang}`}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onSelect(result)}
          className="w-full text-left px-3 py-2 text-[13px] flex justify-between gap-2 border-b"
          style={{ borderColor: 'var(--line)', color: 'var(--ink)' }}
        >
          <span className="truncate">{result.name}</span>
          <span className="shrink-0" style={{ color: 'var(--ink-muted)' }}>
            #{result.localId} {result.lang === 'en' ? '(EN)' : '(JP)'}
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
  const [searchResults, setSearchResults] = useState<TCGdexSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [focusedField, setFocusedField] = useState<'name' | 'number' | null>(null)
  const [selectedCardImage, setSelectedCardImage] = useState<string | null>(null)

  useEffect(() => {
    const nameQuery = card.cardName.trim()
    const numberQuery = card.cardNumber.split('/')[0].trim()
    if (!nameQuery && !numberQuery) {
      setSearchResults([])
      setIsSearching(false)
      return
    }
    setIsSearching(true)
    const t = setTimeout(async () => {
      try {
        setSearchResults(await searchTcgdexCards(nameQuery, numberQuery))
      } catch (err) {
        console.error('TCGdex search error', err)
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 450)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.cardName, card.cardNumber])

  async function selectCard(result: TCGdexSearchResult) {
    setFocusedField(null)
    setSearchResults([])
    const primaryLang = result.lang === 'ja' ? 'ja' : 'en'
    try {
      let res = await fetch(`https://api.tcgdex.net/v2/${primaryLang}/cards/${result.id}`)
      if (!res.ok) res = await fetch(`https://api.tcgdex.net/v2/${primaryLang === 'en' ? 'ja' : 'en'}/cards/${result.id}`)
      if (res.ok) {
        const fullCard = await res.json()
        onUpdateCard(card.id, {
          cardName: fullCard.name ?? result.name,
          cardNumber: fullCard.localId ?? result.localId,
          setName: fullCard.set?.name ?? card.setName,
        })
        setSelectedCardImage(fullCard.image ? `${fullCard.image}/high.png` : null)
      }
    } catch (err) {
      console.error('Card detail fetch error', err)
    }
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

  const showDropdown = focusedField !== null && (isSearching || searchResults.length > 0)

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

      {selectedCardImage && (
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

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="relative">
          <Label className="text-[12.5px]" style={{ color: 'var(--ink-muted)' }}>
            Card name
          </Label>
          <Input
            value={card.cardName}
            onChange={(e) => onUpdateCard(card.id, { cardName: e.target.value })}
            onFocus={() => setFocusedField('name')}
            onBlur={() => {
              setTimeout(() => setFocusedField((f) => (f === 'name' ? null : f)), 150)
              lookupValue()
            }}
            placeholder="Charizard"
          />
          {focusedField === 'name' && showDropdown && (
            <ResultsDropdown results={searchResults} isSearching={isSearching} onSelect={selectCard} />
          )}
        </div>
        <div>
          <Label className="text-[12.5px]" style={{ color: 'var(--ink-muted)' }}>
            Set
          </Label>
          <Input
            value={card.setName}
            onChange={(e) => onUpdateCard(card.id, { setName: e.target.value })}
            onBlur={lookupValue}
            placeholder="Base Set Unlimited"
          />
        </div>
        <div className="relative">
          <Label className="text-[12.5px]" style={{ color: 'var(--ink-muted)' }}>
            Card number
          </Label>
          <Input
            value={card.cardNumber}
            onChange={(e) => onUpdateCard(card.id, { cardNumber: e.target.value })}
            onFocus={() => setFocusedField('number')}
            onBlur={() => setTimeout(() => setFocusedField((f) => (f === 'number' ? null : f)), 150)}
            placeholder="4/102"
          />
          {focusedField === 'number' && showDropdown && (
            <ResultsDropdown results={searchResults} isSearching={isSearching} onSelect={selectCard} />
          )}
        </div>
        <div>
          <Label className="text-[12.5px]" style={{ color: 'var(--ink-muted)' }}>
            Declared value (Rands)
          </Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={card.declaredValue}
            onChange={(e) => onUpdateCard(card.id, { declaredValue: Number(e.target.value) })}
          />
        </div>
      </div>

      <p className="text-[12.5px] mt-3 min-h-[1.2em]" style={{ color: 'var(--ink-muted)' }}>
        {card.isFetchingValue && 'Checking market value…'}
        {!card.isFetchingValue && card.marketValueEstimate !== null && (
          <>
            Market estimate:{' '}
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>${card.marketValueEstimate.toFixed(2)}</span>{' '}
            ({card.marketValueSource})
          </>
        )}
      </p>
    </div>
  )
}
