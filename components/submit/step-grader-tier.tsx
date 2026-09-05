'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { fetchMarketValue } from '@/lib/pricing-client'
import { TIER_OPTIONS } from '@/lib/submission-types'
import type { CardEntry, SubmissionTier } from '@/lib/submission-types'

interface Props {
  tier: SubmissionTier | null
  cards: CardEntry[]
  onSelectTier: (tier: SubmissionTier) => void
  onUpdateCard: (id: string, patch: Partial<CardEntry>) => void
  onAddCard: () => void
  onRemoveCard: (id: string) => void
  onNext: () => void
  canAdvance: boolean
}

export function StepGraderTier({
  tier,
  cards,
  onSelectTier,
  onUpdateCard,
  onAddCard,
  onRemoveCard,
  onNext,
  canAdvance,
}: Props) {
  async function lookupValue(card: CardEntry) {
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

  return (
    <section className="space-y-10">
      <div>
        <h2 className="text-[22px]" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
          Grading company
        </h2>
        <p className="text-[13.5px] mt-2" style={{ color: 'var(--ink-muted)' }}>
          All submissions are graded exclusively by{' '}
          <a
            href="https://premiercardgrading.co.uk/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
            style={{ color: 'var(--ink)' }}
          >
            Premier Card Grading (PCG)
          </a>
          .
        </p>
      </div>

      <div>
        <h2 className="text-[22px]" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
          Turnaround
        </h2>
        <div className="flex flex-col mt-4 border-t" style={{ borderColor: 'var(--line)' }}>
          {TIER_OPTIONS.map((t) => {
            const selected = tier === t.value
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => onSelectTier(t.value)}
                className="flex items-center justify-between py-3.5 border-b text-left gap-4"
                style={{ borderColor: 'var(--line)' }}
              >
                <span className="flex items-center gap-3">
                  <span
                    className="w-3.5 h-3.5 rounded-full border shrink-0"
                    style={{
                      borderColor: selected ? 'var(--seal)' : 'var(--line)',
                      background: selected ? 'var(--seal)' : 'transparent',
                    }}
                  />
                  <span className="text-[15px]" style={{ color: 'var(--ink)' }}>
                    {t.label}
                  </span>
                </span>
                <span
                  className="text-[13px] shrink-0"
                  style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink-muted)' }}
                >
                  {t.turnaround} · {t.feeMultiplier}× base fee
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <h2 className="text-[22px]" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
            Cards in this shipment
          </h2>
          <span className="text-[13px]" style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink-muted)' }}>
            {cards.length} {cards.length === 1 ? 'card' : 'cards'}
          </span>
        </div>

        <div className="mt-4 space-y-4">
          {cards.map((card, i) => (
            <div key={card.id} className="border rounded-[3px] p-4" style={{ borderColor: 'var(--line)' }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[12px]" style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink-muted)' }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                {cards.length > 1 && (
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

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-[12.5px]" style={{ color: 'var(--ink-muted)' }}>
                    Card name
                  </Label>
                  <Input
                    value={card.cardName}
                    onChange={(e) => onUpdateCard(card.id, { cardName: e.target.value })}
                    onBlur={() => lookupValue(card)}
                    placeholder="Charizard"
                  />
                </div>
                <div>
                  <Label className="text-[12.5px]" style={{ color: 'var(--ink-muted)' }}>
                    Set
                  </Label>
                  <Input
                    value={card.setName}
                    onChange={(e) => onUpdateCard(card.id, { setName: e.target.value })}
                    onBlur={() => lookupValue(card)}
                    placeholder="Base Set Unlimited"
                  />
                </div>
                <div>
                  <Label className="text-[12.5px]" style={{ color: 'var(--ink-muted)' }}>
                    Card number
                  </Label>
                  <Input
                    value={card.cardNumber}
                    onChange={(e) => onUpdateCard(card.id, { cardNumber: e.target.value })}
                    placeholder="4/102"
                  />
                </div>
                <div>
                  <Label className="text-[12.5px]" style={{ color: 'var(--ink-muted)' }}>
                    Declared value (USD)
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
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                      ${card.marketValueEstimate.toFixed(2)}
                    </span>{' '}
                    ({card.marketValueSource})
                  </>
                )}
              </p>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onAddCard}
          className="mt-4 text-[13.5px] underline underline-offset-2"
          style={{ color: 'var(--ink)' }}
        >
          + Add another card
        </button>
      </div>

      <div className="flex justify-end pt-2">
        <Button
          onClick={onNext}
          disabled={!canAdvance}
          className="rounded-[3px]"
          style={{ background: 'var(--vault)', color: 'var(--vault-ink)' }}
        >
          Continue to add-ons
        </Button>
      </div>
    </section>
  )
}
