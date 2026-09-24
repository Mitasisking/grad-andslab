'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { ManifestRail } from '@/components/submit/manifest-rail'
import { PoolTracker } from '@/components/PoolTracker'
import { LiveBatchTracker } from '@/components/grading/LiveBatchTracker'
import { StepGraderTier } from '@/components/submit/step-grader-tier'
import { StepAddOns } from '@/components/submit/step-addons'
import { StepReviewPay } from '@/components/submit/step-review-pay'
import { fetchAddresses } from '@/lib/addresses-client'
import { TIER_OPTIONS_BY_COMPANY } from '@/lib/submission-types'
import type {
  AceLabelOption,
  CardEntry,
  EventSettingsRow,
  GradingCompany,
  PoolRow,
  ProductRegion,
  ShippingAddress,
  SubmissionTier,
  SubmissionType,
} from '@/lib/submission-types'

interface Props {
  /** Currently-filling PCG/ACE batches, fetched server-side in app/submit/page.tsx. */
  activePools: PoolRow[]
  /** Mirrors app/submit/page.tsx's SHOW_BATCH_TRACKER feature flag. */
  showBatchTracker: boolean
}

const STEP_COUNT = 3

function createEmptyCard(): CardEntry {
  return {
    id: crypto.randomUUID(),
    cardType: 'pokemon',
    sport: null,
    cardName: '',
    setName: '',
    cardNumber: '',
    year: null,
    externalCardId: null,
    externalSource: null,
    declaredValue: 0,
    marketValueEstimate: null,
    marketValueSource: null,
    isFetchingValue: false,
    cleaningTier: 'none',
    requiresSlabGuard: false,
  }
}

export function SubmissionWizard({ activePools, showBatchTracker }: Props) {
  // Launch rollout: ACE Grading is the sole active service, and every
  // submission ships from South Africa -- Step 1's "Country of origin" and
  // "Grading company" selectors are gone (components/submit/step-grader-tier.tsx),
  // so these are fixed constants rather than state. A ?tier= deep link (e.g.
  // an old bookmark, or the in-page "Join Batch" panel below) can still
  // pre-select one of ACE's own tiers.
  const region: ProductRegion = 'sa'
  const company: GradingCompany = 'ACE'

  const searchParams = useSearchParams()
  const initialTierParam = searchParams.get('tier')
  const initialTier: SubmissionTier | null =
    initialTierParam && TIER_OPTIONS_BY_COMPANY[company].some((t) => t.value === initialTierParam)
      ? (initialTierParam as SubmissionTier)
      : null

  // In-person event drop-off (supabase/migrations/0062_add_in_person_event_intake.sql):
  // a booth QR code links to /submit?intake=in-person&event=slug, which
  // always wins outright. With no such link, fall back to the admin's
  // global event_settings toggle (app/admin/events) -- e.g. a customer who
  // found the booth's tablet already sitting open on /submit.
  const urlIntakeIsInPerson = searchParams.get('intake') === 'in-person'
  const urlEventSlug = searchParams.get('event')
  const [inPersonMode, setInPersonMode] = useState(urlIntakeIsInPerson)
  const [eventSlug, setEventSlug] = useState<string | null>(urlIntakeIsInPerson ? urlEventSlug : null)
  // Display-only name for the "Live Intake Active" badge below -- kept
  // separate from eventSlug (which drives routing/matching) since a name
  // is purely cosmetic. Always fetched, even when the URL param already
  // decided inPersonMode/eventSlug, so a booth QR link still gets a
  // friendly name; only applied when the fetched slug actually matches the
  // slug already in play, so a stale QR code from a past event can't show
  // the wrong (current) event's name.
  const [eventName, setEventName] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/events/active')
      .then((res) => res.json())
      .then((settings: EventSettingsRow) => {
        if (cancelled) return
        if (!urlIntakeIsInPerson) {
          if (settings.is_live) {
            setInPersonMode(true)
            setEventSlug(settings.active_event_slug)
            setEventName(settings.active_event_name)
          }
          return
        }
        if (settings.active_event_slug && settings.active_event_slug === urlEventSlug) {
          setEventName(settings.active_event_name)
        }
      })
      .catch(() => {
        // Best-effort: a failed lookup just leaves the wizard in its normal
        // online-shipment default rather than blocking the page.
      })
    return () => {
      cancelled = true
    }
  }, [urlIntakeIsInPerson, urlEventSlug])

  const [step, setStep] = useState(0)
  const [submissionType, setSubmissionType] = useState<SubmissionType>('batch')
  const [tier, setTier] = useState<SubmissionTier | null>(initialTier)
  const [labelOption, setLabelOption] = useState<AceLabelOption>('standard')
  const [cards, setCards] = useState<CardEntry[]>([createEmptyCard()])
  const [addresses, setAddresses] = useState<ShippingAddress[]>([])
  const [addressesLoaded, setAddressesLoaded] = useState(false)
  const [addressId, setAddressId] = useState<string | null>(null)
  // Launch rollout: Step 2 no longer offers a Semi-Rigids or Consignment
  // toggle (components/submit/step-addons.tsx) -- semi-rigids are now
  // standard on every card (see that file's Pre-grading preparation copy),
  // and consignment interest isn't collected at submission time. Kept as
  // hardcoded false rather than deleted since app/api/submissions/route.ts
  // and its submissions.needs_semi_rigids/interested_in_consignment columns
  // are unchanged, so re-adding either toggle later is just restoring the
  // useState + StepAddOns props.
  const needsSemiRigids = false
  const interestedInConsignment = false

  const cardsSectionRef = useRef<HTMLDivElement>(null)

  const joinBatch = useCallback((nextCompany: GradingCompany, nextTier: SubmissionTier) => {
    // ACE is the only active grading company for launch -- a batch for any
    // other company can't be joined here (there's no selector left to switch
    // to it). Harmless no-op today since LiveBatchTracker is hidden
    // (SHOW_BATCH_TRACKER = false); reconcile this if that flag is ever
    // flipped back on for a multi-company batch tracker.
    if (nextCompany !== company) return
    setTier(nextTier)
    // Deferred a frame so the (possibly newly-rendered) cards section exists
    // to scroll to before we measure its position.
    requestAnimationFrame(() => {
      cardsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchAddresses().then((list) => {
      if (cancelled) return
      setAddresses(list)
      setAddressId((current) => current ?? list[0]?.id ?? null)
      setAddressesLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const handleAddressCreated = useCallback((address: ShippingAddress) => {
    setAddresses((prev) => [...prev, address])
    setAddressId(address.id)
  }, [])

  const updateCard = useCallback((id: string, patch: Partial<CardEntry>) => {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }, [])

  const addCard = useCallback(() => setCards((prev) => [...prev, createEmptyCard()]), [])

  const removeCard = useCallback((id: string) => {
    setCards((prev) => (prev.length > 1 ? prev.filter((c) => c.id !== id) : prev))
  }, [])

  const canAdvanceFromStep1 =
    tier !== null &&
    cards.length > 0 &&
    cards.every(
      (c) =>
        c.cardName.trim() &&
        c.setName.trim() &&
        c.declaredValue >= 0 &&
        // Sport has its own manual dropdown (card-shipment-row.tsx) so it
        // can be set without relying on a search-result match -- required
        // here so a card stuck on a free-typed name still can't reach Pay
        // without one, since submissions.sport is a not-null column for
        // sports cards.
        (c.cardType !== 'sports_card' || c.sport !== null),
    )

  const goNext = () => setStep((s) => Math.min(s + 1, STEP_COUNT - 1))
  const goBack = () => setStep((s) => Math.max(s - 1, 0))

  return (
    <div>
      {inPersonMode && (
        <div
          className="mb-8 inline-flex items-center gap-2 px-3.5 py-2 rounded-[3px] border text-[13px]"
          style={{ borderColor: 'var(--seal)', background: 'var(--paper-raised)', color: 'var(--ink)' }}
        >
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--seal)' }} />
          Live Intake Active{eventName ? ` — Handing in at ${eventName}` : ''}
        </div>
      )}

      {showBatchTracker && step === 0 && <LiveBatchTracker pools={activePools} onSelectBatch={joinBatch} />}

      <div className="grid lg:grid-cols-[220px_1fr] gap-10 lg:gap-16">
        <div className="lg:sticky lg:top-10 lg:self-start space-y-10">
          <ManifestRail currentStep={step} />
          {tier && (
            <div className="hidden lg:block">
              <PoolTracker gradingCompany={company} tier={tier} limit={1} />
            </div>
          )}
        </div>

        <div className="min-w-0">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              {step === 0 && (
                <StepGraderTier
                  company={company}
                  tier={tier}
                  labelOption={labelOption}
                  cards={cards}
                  onSelectTier={setTier}
                  onSelectLabelOption={setLabelOption}
                  onUpdateCard={updateCard}
                  onAddCard={addCard}
                  onRemoveCard={removeCard}
                  onNext={goNext}
                  canAdvance={canAdvanceFromStep1}
                  cardsSectionRef={cardsSectionRef}
                />
              )}

              {step === 1 && (
                <StepAddOns
                  cards={cards}
                  onUpdateCard={updateCard}
                  submissionType={submissionType}
                  onSelectSubmissionType={setSubmissionType}
                  onNext={goNext}
                  onBack={goBack}
                />
              )}

              {step === 2 && tier && (
                <StepReviewPay
                  region={region}
                  gradingCompany={company}
                  submissionType={submissionType}
                  tier={tier}
                  labelOption={labelOption}
                  inPersonMode={inPersonMode}
                  eventSlug={eventSlug}
                  cards={cards}
                  addresses={addresses}
                  addressesLoaded={addressesLoaded}
                  addressId={addressId}
                  needsSemiRigids={needsSemiRigids}
                  interestedInConsignment={interestedInConsignment}
                  onSelectAddress={setAddressId}
                  onToggleInPersonMode={setInPersonMode}
                  onAddressCreated={handleAddressCreated}
                  onBack={goBack}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
