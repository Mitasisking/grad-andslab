'use client'

import type { RefObject } from 'react'
import { Button } from '@/components/ui/button'
import { CardShipmentRow } from '@/components/submit/card-shipment-row'
import { formatGBP, formatZAR } from '@/lib/currency'
import { ACE_LABEL_OPTIONS, TIER_OPTIONS_BY_COMPANY } from '@/lib/submission-types'
import type { AceLabelOption, CardEntry, GradingCompany, SubmissionTier } from '@/lib/submission-types'

interface Props {
  /** Fixed to 'ACE' by app/submit/wizard.tsx for the launch rollout -- still a real prop (rather than hardcoded in this component) so the tier lookup/label-options logic below stays company-driven instead of ACE-specific. */
  company: GradingCompany
  tier: SubmissionTier | null
  labelOption: AceLabelOption
  cards: CardEntry[]
  onSelectTier: (tier: SubmissionTier) => void
  onSelectLabelOption: (option: AceLabelOption) => void
  onUpdateCard: (id: string, patch: Partial<CardEntry>) => void
  onAddCard: () => void
  onRemoveCard: (id: string) => void
  onNext: () => void
  canAdvance: boolean
  /** Scroll target for the /submit batch panel's "Join Batch" action -- see app/submit/wizard.tsx. */
  cardsSectionRef?: RefObject<HTMLDivElement | null>
}

export function StepGraderTier({
  company,
  tier,
  labelOption,
  cards,
  onSelectTier,
  onSelectLabelOption,
  onUpdateCard,
  onAddCard,
  onRemoveCard,
  onNext,
  canAdvance,
  cardsSectionRef,
}: Props) {
  const tierOptions = TIER_OPTIONS_BY_COMPANY[company]
  // Distinct group labels in first-seen order (e.g. ACE's "Flagship"/"Premium").
  // A company with no grouped tiers (PCG, PSA) collapses to a single `null`
  // group, rendering the same flat list as before this field existed.
  const tierGroups = tierOptions.reduce<(string | null)[]>((groups, t) => {
    const g = t.group ?? null
    return groups.includes(g) ? groups : [...groups, g]
  }, [])

  return (
    <section className="space-y-10">
      <div>
        <h2 className="text-[22px]" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
          Turnaround
        </h2>
        {tierGroups.map((groupLabel) => (
          <div key={groupLabel ?? '__ungrouped'}>
            {groupLabel && (
              <h3
                className="text-[12px] uppercase tracking-wide mt-5 first:mt-4"
                style={{ color: 'var(--ink-muted)' }}
              >
                {groupLabel} levels
              </h3>
            )}
            <div className="flex flex-col mt-2 border-t" style={{ borderColor: 'var(--line)' }}>
              {tierOptions
                .filter((t) => (t.group ?? null) === groupLabel)
                .map((t) => {
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
                          {t.description && (
                            <span className="text-[12px] block mt-0.5" style={{ color: 'var(--ink-muted)' }}>
                              {t.description}
                            </span>
                          )}
                          {t.note && (
                            <span className="text-[12px] block mt-0.5" style={{ color: 'var(--ink-muted)' }}>
                              {t.note}
                            </span>
                          )}
                        </span>
                      </span>
                      <span className="shrink-0 text-right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        <span className="text-[13px] block" style={{ color: 'var(--ink-muted)' }}>
                          {t.turnaround ? `${t.turnaround} · ` : ''}
                          {formatGBP(t.basePriceGBP)}/card
                        </span>
                        <span className="text-[11px] block mt-0.5" style={{ color: 'var(--ink-muted)', opacity: 0.7 }}>
                          (Est. conversion: {formatZAR(t.basePriceZAR)})
                        </span>
                      </span>
                    </button>
                  )
                })}
            </div>
          </div>
        ))}
      </div>

      {company === 'ACE' && (
        <div>
          <h2 className="text-[22px]" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
            Label options
          </h2>
          <div className="flex flex-wrap gap-2 mt-4">
            {ACE_LABEL_OPTIONS.map((option) => {
              const selected = labelOption === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onSelectLabelOption(option.value)}
                  className="px-4 py-2 rounded-full border text-[13px] text-left"
                  style={{
                    borderColor: selected ? 'var(--seal)' : 'var(--line)',
                    background: selected ? 'var(--seal)' : 'transparent',
                    color: selected ? 'var(--seal-ink)' : 'var(--ink)',
                  }}
                >
                  <span className="uppercase tracking-wide">{option.label}</span>{' '}
                  <span style={{ opacity: 0.8 }}>
                    {option.feeGBP === 0
                      ? '(Free)'
                      : `(+${formatGBP(option.feeGBP)} / +${formatZAR(option.feeZAR)} per card)`}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div ref={cardsSectionRef}>
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
