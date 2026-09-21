'use client'

import { Button } from '@/components/ui/button'
import { formatByRegion } from '@/lib/currency'
import { SUBMISSION_TYPE_OPTIONS, cleanAndPolishFeeForRegion, inspectionFeeForRegion } from '@/lib/submission-types'
import type { CardEntry, ProductRegion, SubmissionType } from '@/lib/submission-types'

interface YesNoQuestionProps {
  question: string
  subtext?: string
  priceLabel?: string
  value: boolean
  onChange: (value: boolean) => void
}

/** Matches the circular-indicator radio look used throughout the wizard (e.g. step-grader-tier.tsx's country/tier lists). */
function YesNoQuestion({ question, subtext, priceLabel, value, onChange }: YesNoQuestionProps) {
  return (
    <div className="border rounded-[3px] p-4" style={{ borderColor: 'var(--line)' }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[14px]" style={{ color: 'var(--ink)' }}>
            {question}
          </p>
          {subtext && (
            <p className="text-[12.5px] mt-1" style={{ color: 'var(--ink-muted)' }}>
              {subtext}
            </p>
          )}
        </div>
        {priceLabel && (
          <span
            className="text-[13px] shrink-0"
            style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink-muted)' }}
          >
            {priceLabel}
          </span>
        )}
      </div>
      <div className="flex gap-5 mt-3">
        {([true, false] as const).map((option) => {
          const selected = value === option
          return (
            <button
              key={String(option)}
              type="button"
              onClick={() => onChange(option)}
              className="flex items-center gap-2"
            >
              <span
                className="w-3.5 h-3.5 rounded-full border shrink-0"
                style={{
                  borderColor: selected ? 'var(--seal)' : 'var(--line)',
                  background: selected ? 'var(--seal)' : 'transparent',
                }}
              />
              <span className="text-[13.5px]" style={{ color: 'var(--ink)' }}>
                {option ? 'Yes' : 'No'}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** The gold "OR" badge between the per-card and submission-level service tiers -- signals the mutual exclusivity enforced by handleToggleCleanAndPolish/handleTogglePerCardPrep below, not just two unrelated sections stacked together. */
function OrDivider() {
  return (
    <div className="relative flex items-center py-1" aria-hidden="true">
      <div className="flex-1 border-t" style={{ borderColor: 'var(--line)' }} />
      <span
        className="mx-3 px-3.5 py-1 rounded-full text-[11px] font-semibold tracking-wide uppercase"
        style={{ background: 'var(--seal)', color: 'var(--seal-ink)' }}
      >
        Or
      </span>
      <div className="flex-1 border-t" style={{ borderColor: 'var(--line)' }} />
    </div>
  )
}

interface Props {
  cards: CardEntry[]
  onUpdateCard: (id: string, patch: Partial<CardEntry>) => void
  submissionType: SubmissionType
  onSelectSubmissionType: (value: SubmissionType) => void
  needsCleanAndPolish: boolean
  onToggleCleanAndPolish: (value: boolean) => void
  region: ProductRegion
  onNext: () => void
  onBack: () => void
}

export function StepAddOns({
  cards,
  onUpdateCard,
  submissionType,
  onSelectSubmissionType,
  needsCleanAndPolish,
  onToggleCleanAndPolish,
  region,
  onNext,
  onBack,
}: Props) {
  const cleanAndPolishFee = cleanAndPolishFeeForRegion(region)
  const inspectionFee = inspectionFeeForRegion(region)

  // Mutually exclusive with per-card pre-grading prep -- the bulk service
  // already covers every card, so charging both for the same card would be
  // double-billing. Whichever one is turned on forces the other off.
  function handleToggleCleanAndPolish(value: boolean) {
    onToggleCleanAndPolish(value)
    if (value) {
      cards.forEach((card) => {
        if (card.preCheckOptIn) onUpdateCard(card.id, { preCheckOptIn: false })
      })
    }
  }

  function handleTogglePerCardPrep(cardId: string, value: boolean) {
    onUpdateCard(cardId, { preCheckOptIn: value })
    if (value && needsCleanAndPolish) {
      onToggleCleanAndPolish(false)
    }
  }

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
          Pre-grading preparation
        </h2>
        <p className="text-[14px] mt-2 max-w-lg leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
          Our team inspects and lightly cleans surface debris, placed in a new sleeve and semi rigid before shipment
          to the grader — priced per card.
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
                <p className="text-[12.5px] mt-1" style={{ color: 'var(--ink-muted)' }}>
                  Do you require pre-grading preparation services for this card?
                </p>
              </div>
              <span
                className="text-[13px] shrink-0"
                style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink-muted)' }}
              >
                {formatByRegion(inspectionFee, region)}
              </span>
            </div>
            {needsCleanAndPolish ? (
              <p
                className="text-[12.5px] mt-3 px-2.5 py-1.5 rounded-[3px] inline-block"
                style={{ color: 'var(--seal-ink)', background: 'var(--seal)' }}
              >
                Full submission Clean and Polish active
              </p>
            ) : (
              <div className="flex gap-5 mt-3">
                {([true, false] as const).map((option) => {
                  const selected = card.preCheckOptIn === option
                  return (
                    <button
                      key={String(option)}
                      type="button"
                      onClick={() => handleTogglePerCardPrep(card.id, option)}
                      className="flex items-center gap-2"
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full border shrink-0"
                        style={{
                          borderColor: selected ? 'var(--seal)' : 'var(--line)',
                          background: selected ? 'var(--seal)' : 'transparent',
                        }}
                      />
                      <span className="text-[13.5px]" style={{ color: 'var(--ink)' }}>
                        {option ? 'Yes' : 'No'}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      <OrDivider />

      <div>
        <h2 className="text-[22px]" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
          Full Clean &amp; Polish
        </h2>

        <div className="mt-4 space-y-3">
          <YesNoQuestion
            question="Do you require a full Clean and Polish service for this submission?"
            subtext="A deeper surface clean and polish pass, with a new sleeve and semi rigid"
            priceLabel={formatByRegion(cleanAndPolishFee, region)}
            value={needsCleanAndPolish}
            onChange={handleToggleCleanAndPolish}
          />
        </div>
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
