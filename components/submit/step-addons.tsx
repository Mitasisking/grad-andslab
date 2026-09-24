'use client'

import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { formatZAR } from '@/lib/currency'
import {
  CLEANING_TIER_OPTIONS,
  SLAB_GUARD_FEE_ZAR,
  SLAB_GUARD_LABEL,
  SUBMISSION_TYPE_OPTIONS,
} from '@/lib/submission-types'
import type { CardEntry, SubmissionType } from '@/lib/submission-types'

interface OptionTileProps {
  label: string
  priceLabel: string
  selected: boolean
  onSelect: () => void
}

/** One choice in a per-card radio group -- same circular gold indicator as the rest of the wizard (e.g. step-grader-tier.tsx's tier list). */
function OptionTile({ label, priceLabel, selected, onSelect }: OptionTileProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className="flex items-center justify-between gap-3 border rounded-[3px] px-3 py-2.5 text-left"
      style={{
        borderColor: selected ? 'var(--seal)' : 'var(--line)',
        background: selected ? 'var(--paper-raised)' : 'transparent',
      }}
    >
      <span className="flex items-center gap-2.5">
        <span
          className="w-3.5 h-3.5 rounded-full border shrink-0"
          style={{
            borderColor: selected ? 'var(--seal)' : 'var(--line)',
            background: selected ? 'var(--seal)' : 'transparent',
          }}
        />
        <span className="text-[13.5px]" style={{ color: 'var(--ink)' }}>
          {label}
        </span>
      </span>
      <span
        className="text-[12.5px] shrink-0"
        style={{ fontVariantNumeric: 'tabular-nums', color: selected ? 'var(--seal)' : 'var(--ink-muted)' }}
      >
        {priceLabel}
      </span>
    </button>
  )
}

interface OptionGroupProps {
  heading: string
  subtext: string
  columnsClassName: string
  children: ReactNode
}

function OptionGroup({ heading, subtext, columnsClassName, children }: OptionGroupProps) {
  return (
    <div>
      <p className="text-[13px]" style={{ color: 'var(--ink)' }}>
        {heading}
      </p>
      <p className="text-[12px] mt-0.5" style={{ color: 'var(--ink-muted)' }}>
        {subtext}
      </p>
      <div role="radiogroup" aria-label={heading} className={`grid gap-2 mt-2.5 ${columnsClassName}`}>
        {children}
      </div>
    </div>
  )
}

interface Props {
  cards: CardEntry[]
  onUpdateCard: (id: string, patch: Partial<CardEntry>) => void
  submissionType: SubmissionType
  onSelectSubmissionType: (value: SubmissionType) => void
  onNext: () => void
  onBack: () => void
}

export function StepAddOns({ cards, onUpdateCard, submissionType, onSelectSubmissionType, onNext, onBack }: Props) {
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-[22px]" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
          Submission Method
        </h2>
        <p className="text-[13.5px] mt-1.5" style={{ color: 'var(--ink-muted)' }}>
          Choose how your shipment is dispatched to ACE Grading in the UK.
        </p>
        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          {SUBMISSION_TYPE_OPTIONS.map((option) => {
            const selected = submissionType === option.value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onSelectSubmissionType(option.value)}
                className="text-left border rounded-[3px] p-4"
                style={{
                  borderColor: selected ? 'var(--seal)' : 'var(--line)',
                  background: selected ? 'var(--paper-raised)' : 'transparent',
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex items-center gap-2.5">
                    <span
                      className="w-3.5 h-3.5 rounded-full border shrink-0"
                      style={{
                        borderColor: selected ? 'var(--seal)' : 'var(--line)',
                        background: selected ? 'var(--seal)' : 'transparent',
                      }}
                    />
                    <span className="text-[15px]" style={{ color: 'var(--ink)' }}>
                      {option.label}
                    </span>
                  </span>
                  <span
                    className="shrink-0 px-2 py-0.5 rounded-full text-[10.5px] font-semibold uppercase tracking-wide"
                    style={{ background: 'var(--seal)', color: 'var(--seal-ink)' }}
                  >
                    {option.badge}
                  </span>
                </div>
                <p className="text-[13px] mt-2.5" style={{ color: 'var(--ink)' }}>
                  {option.summary}
                </p>
                <p className="text-[12px] mt-1.5" style={{ color: 'var(--ink-muted)' }}>
                  {option.detail}
                </p>
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <h2 className="text-[22px]" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
          Card add-ons
        </h2>
        <p className="text-[14px] mt-2 max-w-lg leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
          Choose a clean and Slab Guard for each card individually. Every card is placed in a new sleeve and semi
          rigid before shipment to the grader.
        </p>
      </div>

      <div className="space-y-4">
        {cards.map((card, i) => (
          <div key={card.id} className="border rounded-[3px] p-4 sm:p-5" style={{ borderColor: 'var(--card-border)' }}>
            <p className="text-[12px]" style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink-muted)' }}>
              {String(i + 1).padStart(2, '0')}
            </p>
            <p className="text-[15px] mt-0.5" style={{ color: 'var(--ink)' }}>
              {card.cardName || 'Untitled card'}
              <span style={{ color: 'var(--ink-muted)' }}> — {card.setName || 'Unspecified set'}</span>
            </p>

            <div className="mt-4 space-y-4">
              <OptionGroup
                heading="Cleaning"
                subtext="Surface debris removed by our team before grading."
                columnsClassName="sm:grid-cols-3"
              >
                {CLEANING_TIER_OPTIONS.map((option) => (
                  <OptionTile
                    key={option.value}
                    label={option.label}
                    priceLabel={formatZAR(option.feeZAR)}
                    selected={card.cleaningTier === option.value}
                    onSelect={() => onUpdateCard(card.id, { cleaningTier: option.value })}
                  />
                ))}
              </OptionGroup>

              <div className="border-t" style={{ borderColor: 'var(--line)' }} />

              <OptionGroup
                heading={SLAB_GUARD_LABEL}
                subtext="A premium protective bumper fitted to this card's graded slab."
                columnsClassName="grid-cols-2"
              >
                <OptionTile
                  label="Yes"
                  priceLabel={formatZAR(SLAB_GUARD_FEE_ZAR)}
                  selected={card.requiresSlabGuard}
                  onSelect={() => onUpdateCard(card.id, { requiresSlabGuard: true })}
                />
                <OptionTile
                  label="No"
                  priceLabel={formatZAR(0)}
                  selected={!card.requiresSlabGuard}
                  onSelect={() => onUpdateCard(card.id, { requiresSlabGuard: false })}
                />
              </OptionGroup>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onBack} className="rounded-[3px]">
          Back
        </Button>
        <Button onClick={onNext} className="rounded-[3px]">
          Continue to review
        </Button>
      </div>
    </section>
  )
}
