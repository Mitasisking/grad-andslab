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
  GradingCompany,
  PoolRow,
  ProductRegion,
  ShippingAddress,
  SubmissionTier,
} from '@/lib/submission-types'

interface Props {
  /** Currently-filling PCG/ACE batches, fetched server-side in app/submit/page.tsx. */
  activePools: PoolRow[]
  /** Mirrors app/submit/page.tsx's SHOW_BATCH_TRACKER feature flag. */
  showBatchTracker: boolean
}

const VALID_COMPANIES = new Set<GradingCompany>(['PCG', 'PSA', 'ACE'])

function isValidCompany(value: string | null): value is GradingCompany {
  return value !== null && VALID_COMPANIES.has(value as GradingCompany)
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
    preCheckOptIn: false,
  }
}

export function SubmissionWizard({ activePools, showBatchTracker }: Props) {
  // Pre-selects grader + tier when arriving from a link that already knows
  // which batch a customer wants to join -- e.g. an old bookmarked
  // /submit?company=PCG&tier=standard link (the same deep-link the
  // in-page "Join Batch" panel below now sets directly instead). Falls
  // back to this wizard's own defaults for a plain /submit visit with no
  // query string.
  const searchParams = useSearchParams()
  const initialCompany: GradingCompany = isValidCompany(searchParams.get('company')) ? (searchParams.get('company') as GradingCompany) : 'PCG'
  const initialTierParam = searchParams.get('tier')
  const initialTier: SubmissionTier | null =
    initialTierParam && TIER_OPTIONS_BY_COMPANY[initialCompany].some((t) => t.value === initialTierParam)
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

  useEffect(() => {
    if (urlIntakeIsInPerson) return // the URL param already decided this, unambiguously
    let cancelled = false
    fetch('/api/events/active')
      .then((res) => res.json())
      .then((settings: { active_event_slug: string | null; is_live: boolean }) => {
        if (cancelled || !settings.is_live) return
        setInPersonMode(true)
        setEventSlug(settings.active_event_slug)
      })
      .catch(() => {
        // Best-effort: a failed lookup just leaves the wizard in its normal
        // online-shipment default rather than blocking the page.
      })
    return () => {
      cancelled = true
    }
  }, [urlIntakeIsInPerson])

  const [step, setStep] = useState(0)
  const [region, setRegion] = useState<ProductRegion>('sa')
  const [company, setCompany] = useState<GradingCompany>(initialCompany)
  const [tier, setTier] = useState<SubmissionTier | null>(initialTier)
  const [labelOption, setLabelOption] = useState<AceLabelOption>('standard')
  const [cards, setCards] = useState<CardEntry[]>([createEmptyCard()])
  const [addresses, setAddresses] = useState<ShippingAddress[]>([])
  const [addressesLoaded, setAddressesLoaded] = useState(false)
  const [addressId, setAddressId] = useState<string | null>(null)
  const [courier, setCourier] = useState<string | null>(null)
  const [needsCleanAndPolish, setNeedsCleanAndPolish] = useState(false)
  const [needsSemiRigids, setNeedsSemiRigids] = useState(false)
  const [interestedInConsignment, setInterestedInConsignment] = useState(false)

  const cardsSectionRef = useRef<HTMLDivElement>(null)

  const joinBatch = useCallback((nextCompany: GradingCompany, nextTier: SubmissionTier) => {
    setCompany(nextCompany)
    setTier(nextTier)
    if (nextCompany !== 'ACE') setLabelOption('standard')
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

  const selectCompany = useCallback((next: GradingCompany) => {
    setCompany(next)
    // Tiers are company-specific (lib/submission-types.ts TIER_OPTIONS_BY_COMPANY),
    // so a tier chosen under one company is never valid under another.
    setTier(null)
    // Label options only exist for ACE (components/submit/step-grader-tier.tsx
    // hides the selector for every other company) -- reset to the free
    // default so a stale non-standard choice can't silently carry over if
    // the customer switches away from ACE and back.
    if (next !== 'ACE') setLabelOption('standard')
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
                  region={region}
                  company={company}
                  tier={tier}
                  labelOption={labelOption}
                  cards={cards}
                  onSelectRegion={setRegion}
                  onSelectCompany={selectCompany}
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
                  needsCleanAndPolish={needsCleanAndPolish}
                  onToggleCleanAndPolish={setNeedsCleanAndPolish}
                  needsSemiRigids={needsSemiRigids}
                  onToggleSemiRigids={setNeedsSemiRigids}
                  interestedInConsignment={interestedInConsignment}
                  onToggleConsignment={setInterestedInConsignment}
                  region={region}
                  onNext={goNext}
                  onBack={goBack}
                />
              )}

              {step === 2 && tier && (
                <StepReviewPay
                  region={region}
                  gradingCompany={company}
                  tier={tier}
                  labelOption={labelOption}
                  inPersonMode={inPersonMode}
                  eventSlug={eventSlug}
                  cards={cards}
                  addresses={addresses}
                  addressesLoaded={addressesLoaded}
                  addressId={addressId}
                  courier={courier}
                  needsCleanAndPolish={needsCleanAndPolish}
                  needsSemiRigids={needsSemiRigids}
                  interestedInConsignment={interestedInConsignment}
                  onSelectAddress={setAddressId}
                  onSelectCourier={setCourier}
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
