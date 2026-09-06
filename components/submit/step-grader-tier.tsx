'use client'

import { Button } from '@/components/ui/button'
import { CardShipmentRow } from '@/components/submit/card-shipment-row'
import { formatUSD } from '@/lib/currency'
import { GRADING_COMPANY_OPTIONS, TIER_OPTIONS_BY_COMPANY } from '@/lib/submission-types'
import type { CardEntry, GradingCompany, SubmissionTier } from '@/lib/submission-types'

interface Props {
  company: GradingCompany
  tier: SubmissionTier | null
  cards: CardEntry[]
  onSelectCompany: (company: GradingCompany) => void
  onSelectTier: (tier: SubmissionTier) => void
  onUpdateCard: (id: string, patch: Partial<CardEntry>) => void
  onAddCard: () => void
  onRemoveCard: (id: string) => void
  onNext: () => void
  canAdvance: boolean
}

export function StepGraderTier({
  company,
  tier,
  cards,
  onSelectCompany,
  onSelectTier,
  onUpdateCard,
  onAddCard,
  onRemoveCard,
  onNext,
  canAdvance,
}: Props) {
  const selectedCompanyMeta = GRADING_COMPANY_OPTIONS.find((c) => c.value === company)!
  const tierOptions = TIER_OPTIONS_BY_COMPANY[company]

  return (
    <section className="space-y-10">
      <div>
        <h2 className="text-[22px]" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
          Grading company
        </h2>
        <div className="flex flex-col mt-4 border-t" style={{ borderColor: 'var(--line)' }}>
          {GRADING_COMPANY_OPTIONS.map((c) => {
            const selected = company === c.value
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => onSelectCompany(c.value)}
                className="flex items-center gap-3 py-3.5 border-b text-left"
                style={{ borderColor: 'var(--line)' }}
              >
                <span
                  className="w-3.5 h-3.5 rounded-full border shrink-0"
                  style={{
                    borderColor: selected ? 'var(--seal)' : 'var(--line)',
                    background: selected ? 'var(--seal)' : 'transparent',
                  }}
                />
                <span className="text-[15px]" style={{ color: 'var(--ink)' }}>
                  {c.label}
                </span>
              </button>
            )
          })}
        </div>
        {selectedCompanyMeta.url && (
          <p className="text-[13.5px] mt-2" style={{ color: 'var(--ink-muted)' }}>
            Learn more about{' '}
            <a
              href={selectedCompanyMeta.url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
              style={{ color: 'var(--ink)' }}
            >
              {selectedCompanyMeta.label}
            </a>
            .
          </p>
        )}
      </div>

      <div>
        <h2 className="text-[22px]" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
          Turnaround
        </h2>
        <div className="flex flex-col mt-4 border-t" style={{ borderColor: 'var(--line)' }}>
          {tierOptions.map((t) => {
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
                  <span>
                    <span className="text-[15px] block" style={{ color: 'var(--ink)' }}>
                      {t.label}
                    </span>
                    {t.note && (
                      <span className="text-[12px] block mt-0.5" style={{ color: 'var(--ink-muted)' }}>
                        {t.note}
                      </span>
                    )}
                  </span>
                </span>
                <span
                  className="text-[13px] shrink-0 text-right"
                  style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink-muted)' }}
                >
                  {t.turnaround ? `${t.turnaround} · ` : ''}
                  {formatUSD(t.basePriceUSD)}/card
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
            <CardShipmentRow
              key={card.id}
              card={card}
              index={i}
              canRemove={cards.length > 1}
              onUpdateCard={onUpdateCard}
              onRemoveCard={onRemoveCard}
            />
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
