'use client'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import type { CardEntry } from '@/lib/submission-types'

interface Props {
  cards: CardEntry[]
  onUpdateCard: (id: string, patch: Partial<CardEntry>) => void
  onNext: () => void
  onBack: () => void
}

export function StepAddOns({ cards, onUpdateCard, onNext, onBack }: Props) {
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-[22px]" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
          Pre-grading inspection
        </h2>
        <p className="text-[14px] mt-2 max-w-lg leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
          Our team inspects and lightly cleans surface debris before shipment to the grader.
        </p>
      </div>

      <div className="space-y-4">
        {cards.map((card, i) => (
          <div key={card.id} className="border rounded-[3px] p-4" style={{ borderColor: 'var(--line)' }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[12px]" style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink-muted)' }}>
                  {String(i + 1).padStart(2, '0')}
                </p>
                <p className="text-[15px] mt-0.5" style={{ color: 'var(--ink)' }}>
                  {card.cardName || 'Untitled card'}
                  <span style={{ color: 'var(--ink-muted)' }}> — {card.setName || 'Unspecified set'}</span>
                </p>
              </div>
              <label className="flex items-center gap-2 shrink-0">
                <Checkbox
                  checked={card.preCheckOptIn}
                  onCheckedChange={(checked) => onUpdateCard(card.id, { preCheckOptIn: checked === true })}
                />
                <span className="text-[13.5px]" style={{ color: 'var(--ink)' }}>
                  Inspect &amp; clean
                </span>
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onBack} className="rounded-[3px]">
          Back
        </Button>
        <Button onClick={onNext} className="rounded-[3px]" style={{ background: 'var(--vault)', color: 'var(--vault-ink)' }}>
          Continue to review
        </Button>
      </div>
    </section>
  )
}
