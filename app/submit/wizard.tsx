'use client'

import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ManifestRail } from '@/components/submit/manifest-rail'
import { StepGraderTier } from '@/components/submit/step-grader-tier'
import { StepAddOns } from '@/components/submit/step-addons'
import { StepReviewPay } from '@/components/submit/step-review-pay'
import { fetchAddresses } from '@/lib/addresses-client'
import { GRADING_COMPANY } from '@/lib/submission-types'
import type { CardEntry, ShippingAddress, SubmissionTier } from '@/lib/submission-types'

const STEP_COUNT = 3

function createEmptyCard(): CardEntry {
  return {
    id: crypto.randomUUID(),
    cardName: '',
    setName: '',
    cardNumber: '',
    declaredValue: 0,
    marketValueEstimate: null,
    marketValueSource: null,
    isFetchingValue: false,
    preCheckOptIn: false,
    precheckAction: 'proceed_regardless',
    targetGrade: null,
  }
}

export function SubmissionWizard() {
  const [step, setStep] = useState(0)
  const [tier, setTier] = useState<SubmissionTier | null>(null)
  const [cards, setCards] = useState<CardEntry[]>([createEmptyCard()])
  const [addresses, setAddresses] = useState<ShippingAddress[]>([])
  const [addressesLoaded, setAddressesLoaded] = useState(false)
  const [addressId, setAddressId] = useState<string | null>(null)
  const [courier, setCourier] = useState<string | null>(null)

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
    cards.every((c) => c.cardName.trim() && c.setName.trim() && c.declaredValue >= 0)

  const canAdvanceFromStep2 = cards.every(
    (c) => c.precheckAction === 'proceed_regardless' || (c.targetGrade !== null && c.targetGrade > 0),
  )

  const goNext = () => setStep((s) => Math.min(s + 1, STEP_COUNT - 1))
  const goBack = () => setStep((s) => Math.max(s - 1, 0))

  return (
    <div className="grid lg:grid-cols-[220px_1fr] gap-10 lg:gap-16">
      <ManifestRail currentStep={step} />

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
                tier={tier}
                cards={cards}
                onSelectTier={setTier}
                onUpdateCard={updateCard}
                onAddCard={addCard}
                onRemoveCard={removeCard}
                onNext={goNext}
                canAdvance={canAdvanceFromStep1}
              />
            )}

            {step === 1 && (
              <StepAddOns
                cards={cards}
                onUpdateCard={updateCard}
                onNext={goNext}
                onBack={goBack}
                canAdvance={canAdvanceFromStep2}
              />
            )}

            {step === 2 && tier && (
              <StepReviewPay
                gradingCompany={GRADING_COMPANY}
                tier={tier}
                cards={cards}
                addresses={addresses}
                addressesLoaded={addressesLoaded}
                addressId={addressId}
                courier={courier}
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
  )
}
