'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { AddAddressForm } from '@/components/submit/add-address-form'
import { formatByRegion } from '@/lib/currency'
import {
  ACE_LABEL_OPTIONS,
  DOMESTIC_COURIER_LABEL,
  IN_PERSON_DROPOFF_LABEL,
  INTERNATIONAL_COURIER_LEG_LABELS,
  LOCAL_COURIER_LEG_LABELS,
  LOCAL_IN_PERSON_LEG_LABELS,
  TIER_OPTIONS_BY_COMPANY,
  cleanAndPolishFeeForRegion,
  domesticCourierLegFeeForRegion,
  inspectionFeeForRegion,
  internationalCourierLegFeeForRegion,
  labelOptionFeeForRegion,
  tierPriceForRegion,
} from '@/lib/submission-types'
import type {
  AceLabelOption,
  CardEntry,
  GradingCompany,
  ProductRegion,
  ShippingAddress,
  SubmissionTier,
  SubmissionType,
} from '@/lib/submission-types'

interface Props {
  region: ProductRegion
  gradingCompany: GradingCompany
  submissionType: SubmissionType
  tier: SubmissionTier
  labelOption: AceLabelOption
  inPersonMode: boolean
  eventSlug: string | null
  cards: CardEntry[]
  addresses: ShippingAddress[]
  addressesLoaded: boolean
  addressId: string | null
  needsCleanAndPolish: boolean
  needsSemiRigids: boolean
  interestedInConsignment: boolean
  onSelectAddress: (id: string) => void
  onToggleInPersonMode: (value: boolean) => void
  onAddressCreated: (address: ShippingAddress) => void
  onBack: () => void
}

export function StepReviewPay({
  region,
  gradingCompany,
  submissionType,
  tier,
  labelOption,
  inPersonMode,
  eventSlug,
  cards,
  addresses,
  addressesLoaded,
  addressId,
  needsCleanAndPolish,
  needsSemiRigids,
  interestedInConsignment,
  onSelectAddress,
  onToggleInPersonMode,
  onAddressCreated,
  onBack,
}: Props) {
  const [showAddAddress, setShowAddAddress] = useState(false)
  const [creatingOrder, setCreatingOrder] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  const tierMeta = TIER_OPTIONS_BY_COMPANY[gradingCompany].find((t) => t.value === tier)!

  // Everything here is priced in the country-of-origin's currency (region,
  // hardcoded to 'sa' in app/submit/wizard.tsx for the launch rollout), and
  // api/submissions/checkout charges Payfast the matching ZAR amount to
  // stay consistent with what's shown here.
  const perCardFee = tierPriceForRegion(tierMeta, region)
  const gradingSubtotal = perCardFee * cards.length

  // Label options only apply to ACE (components/submit/step-grader-tier.tsx
  // hides the selector for every other company); labelOption otherwise
  // stays at its 'standard' (free) default and contributes nothing. Unlike
  // the CuppasCards Services line below, this line is always shown in the
  // Order Summary (even at R 0,00 for the free Standard option) so the
  // customer can see which label was chosen.
  const labelOptionMeta = ACE_LABEL_OPTIONS.find((o) => o.value === labelOption)!
  const labelOptionSubtotal = gradingCompany === 'ACE' ? labelOptionFeeForRegion(labelOptionMeta, region) * cards.length : 0

  // "CuppasCards Services" collapses the two mutually-exclusive pre-grading
  // add-ons (components/submit/step-addons.tsx's handleToggleCleanAndPolish/
  // handleTogglePerCardPrep) into a single Order Summary line, since a
  // submission can only ever have one of the two active at a time.
  const cardsWithPrepCount = cards.filter((c) => c.preCheckOptIn).length
  const inspectionSubtotal = cardsWithPrepCount * inspectionFeeForRegion(region)
  const cleanAndPolishSubtotal = needsCleanAndPolish ? cleanAndPolishFeeForRegion(region) : 0
  const cuppasServicesSubtotal = needsCleanAndPolish ? cleanAndPolishSubtotal : inspectionSubtotal
  const cuppasServicesLabel = needsCleanAndPolish
    ? 'Full Clean & Polish'
    : cardsWithPrepCount > 0
      ? `Pre-grading preparation × ${cardsWithPrepCount}`
      : 'Pre-grading preparation'

  // Domestic leg (customer <-> HQ), via The Courier Guy's Pudo Locker-to-
  // Locker service -- billed as two separate legs, zero-rated entirely when
  // the customer instead chooses in-person drop-off in "Ship from" below.
  const domesticLegFee = domesticCourierLegFeeForRegion(region)
  const localCourierTotal = inPersonMode ? 0 : domesticLegFee * 2

  // International leg (SA <-> ACE Grading's UK facility) -- billed as two
  // separate legs regardless of delivery method, since every submission
  // still has to make the same round trip to the grader.
  const internationalLegFee = internationalCourierLegFeeForRegion(submissionType, region)
  const internationalCourierLabels = INTERNATIONAL_COURIER_LEG_LABELS[submissionType]
  const internationalCourierTotal = internationalLegFee * 2

  const serviceFee = gradingSubtotal + labelOptionSubtotal + cuppasServicesSubtotal + internationalCourierTotal
  const total = serviceFee + localCourierTotal
  const canCheckout = Boolean(addressId)

  async function beginCheckout() {
    if (!canCheckout) return
    setCreatingOrder(true)
    setCheckoutError(null)

    // Step A: create the submission (and its items) server-side. The row's
    // qr_code_token is generated by Postgres and only ever read back here —
    // it exists only once a real, addressed order has been created, so no
    // token is ever minted for an order that doesn't exist in the database.
    const submissionRes = await fetch('/api/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gradingCompany,
        submissionType,
        tier,
        region,
        addressId,
        courier: inPersonMode ? IN_PERSON_DROPOFF_LABEL : DOMESTIC_COURIER_LABEL,
        serviceFee,
        needsCleanAndPolish,
        needsSemiRigids,
        interestedInConsignment,
        aceLabelOption: gradingCompany === 'ACE' ? labelOption : null,
        intakeChannel: inPersonMode ? 'in_person_event' : 'online_shipment',
        eventSlug: inPersonMode ? eventSlug : null,
        items: cards.map((c) => ({
          cardType: c.cardType,
          sport: c.sport,
          cardName: c.cardName,
          setName: c.setName,
          cardNumber: c.cardNumber,
          year: c.year,
          externalCardId: c.externalCardId,
          externalSource: c.externalSource,
          declaredValue: c.declaredValue,
          marketValueEstimate: c.marketValueEstimate,
          marketValueSource: c.marketValueSource,
          preCheckOptIn: c.preCheckOptIn,
        })),
      }),
    })
    const submissionData = await submissionRes.json()

    if (!submissionRes.ok) {
      setCreatingOrder(false)
      setCheckoutError(submissionData.error ?? 'Could not create the submission. Please try again.')
      return
    }

    // Step B: get the Payfast redirect for that real submission id.
    // Deliberately not /api/checkout — that path is still the legacy shop
    // cart's mock endpoint (see app/shop/page.tsx); this flow gets its own
    // path so the two don't collide.
    const checkoutRes = await fetch('/api/submissions/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amountCents: Math.round(total * 100),
        submissionId: submissionData.submissionId,
      }),
    })
    const checkoutData = await checkoutRes.json()

    if (!checkoutRes.ok || !checkoutData.redirectUrl) {
      setCreatingOrder(false)
      setCheckoutError(checkoutData.error ?? 'Could not start payment. Please try again.')
      return
    }

    window.location.href = checkoutData.redirectUrl
  }

  return (
    <section className="space-y-8">
      <div>
        <h2 className="text-[22px]" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
          Ship from
        </h2>

        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          <button
            type="button"
            onClick={() => onToggleInPersonMode(false)}
            className="text-left border rounded-[3px] p-4"
            style={{
              borderColor: !inPersonMode ? 'var(--seal)' : 'var(--line)',
              background: !inPersonMode ? 'var(--paper-raised)' : 'transparent',
            }}
          >
            <span className="flex items-center gap-2.5">
              <span
                className="w-3.5 h-3.5 rounded-full border shrink-0"
                style={{
                  borderColor: !inPersonMode ? 'var(--seal)' : 'var(--line)',
                  background: !inPersonMode ? 'var(--seal)' : 'transparent',
                }}
              />
              <span className="text-[15px]" style={{ color: 'var(--ink)' }}>
                Courier Delivery
              </span>
            </span>
            <p className="text-[13px] mt-2.5" style={{ color: 'var(--ink)' }}>
              Ship your cards to us via {DOMESTIC_COURIER_LABEL}.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onToggleInPersonMode(true)}
            className="text-left border rounded-[3px] p-4"
            style={{
              borderColor: inPersonMode ? 'var(--seal)' : 'var(--line)',
              background: inPersonMode ? 'var(--paper-raised)' : 'transparent',
            }}
          >
            <span className="flex items-center gap-2.5">
              <span
                className="w-3.5 h-3.5 rounded-full border shrink-0"
                style={{
                  borderColor: inPersonMode ? 'var(--seal)' : 'var(--line)',
                  background: inPersonMode ? 'var(--seal)' : 'transparent',
                }}
              />
              <span className="text-[15px]" style={{ color: 'var(--ink)' }}>
                In-Person Drop-Off
              </span>
            </span>
            <p className="text-[13px] mt-2.5" style={{ color: 'var(--ink)' }}>
              Bring your cards to us directly — no domestic courier fees.
            </p>
          </button>
        </div>

        {addressesLoaded && addresses.length === 0 && !showAddAddress && (
          <p className="text-[13.5px] mt-3" style={{ color: 'var(--ink-muted)' }}>
            No saved addresses yet.
          </p>
        )}

        {addresses.length > 0 && (
          <div className="flex flex-col mt-3 border-t" style={{ borderColor: 'var(--line)' }}>
            {addresses.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => onSelectAddress(a.id)}
                className="flex items-center justify-between py-3 border-b text-left gap-4"
                style={{ borderColor: 'var(--line)' }}
              >
                <span className="text-[14px]" style={{ color: 'var(--ink)' }}>
                  {a.name} — {a.line1}, {a.city} {a.state} {a.postal}
                </span>
                <span
                  className="w-3.5 h-3.5 rounded-full border shrink-0"
                  style={{
                    borderColor: addressId === a.id ? 'var(--seal)' : 'var(--line)',
                    background: addressId === a.id ? 'var(--seal)' : 'transparent',
                  }}
                />
              </button>
            ))}
          </div>
        )}

        {!showAddAddress ? (
          <button
            type="button"
            onClick={() => setShowAddAddress(true)}
            className="mt-3 text-[13.5px] underline underline-offset-2"
            style={{ color: 'var(--ink)' }}
          >
            + Add a new address
          </button>
        ) : (
          <AddAddressForm
            onCreated={(address) => {
              onAddressCreated(address)
              setShowAddAddress(false)
            }}
            onCancel={() => setShowAddAddress(false)}
          />
        )}
      </div>

      {!inPersonMode && (
        <div>
          <h2 className="text-[22px]" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
            Courier
          </h2>
          <div className="flex items-center justify-between py-3 mt-3 border-t border-b" style={{ borderColor: 'var(--line)' }}>
            <span className="text-[14px]" style={{ color: 'var(--ink)' }}>
              {DOMESTIC_COURIER_LABEL}
            </span>
            <span className="text-[13px]" style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink-muted)' }}>
              {formatByRegion(domesticLegFee, region)} each way
            </span>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-[22px]" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
          Order summary
        </h2>
        <div className="mt-3 text-[14px] space-y-1.5" style={{ color: 'var(--ink)' }}>
          {/* 1. ACE Grading Fees */}
          <div className="flex justify-between gap-4">
            <span>
              {gradingCompany} grading × {cards.length} ({tierMeta.label})
            </span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatByRegion(gradingSubtotal, region)}</span>
          </div>

          {/* 2. ACE Label Fees */}
          {gradingCompany === 'ACE' && (
            <div className="flex justify-between gap-4">
              <span>
                {labelOptionMeta.label} label × {cards.length}
              </span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatByRegion(labelOptionSubtotal, region)}</span>
            </div>
          )}

          {/* 3. CuppasCards Services */}
          <div className="flex justify-between gap-4">
            <span>{cuppasServicesLabel}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatByRegion(cuppasServicesSubtotal, region)}</span>
          </div>

          {/* 4. Local Courier Fees */}
          {inPersonMode ? (
            <>
              <div className="flex justify-between gap-4">
                <span>{LOCAL_IN_PERSON_LEG_LABELS.outbound}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatByRegion(0, region)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span>{LOCAL_IN_PERSON_LEG_LABELS.returnLeg}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatByRegion(0, region)}</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between gap-4">
                <span>{LOCAL_COURIER_LEG_LABELS.outbound}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatByRegion(domesticLegFee, region)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span>{LOCAL_COURIER_LEG_LABELS.returnLeg}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatByRegion(domesticLegFee, region)}</span>
              </div>
            </>
          )}

          {/* 5. International Courier Fees */}
          <div className="flex justify-between gap-4">
            <span>{internationalCourierLabels.outbound}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatByRegion(internationalLegFee, region)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span>{internationalCourierLabels.returnLeg}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatByRegion(internationalLegFee, region)}</span>
          </div>

          {/* 6. Total Due Today */}
          <div
            className="flex justify-between gap-4 pt-2 mt-2 border-t text-[15px]"
            style={{ borderColor: 'var(--line)' }}
          >
            <span>Total due today</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatByRegion(total, region)}</span>
          </div>
        </div>

        <p className="text-[12px] mt-4 leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
          <strong style={{ color: 'var(--ink)' }}>Import &amp; Customs Notice:</strong> International return
          shipments are subject to South African customs clearance. Estimates typically include ~20% customs duty
          assessment and 15% VAT on declared grading/service values upon re-entry, billed prior to final domestic
          dispatch.
        </p>
      </div>

      {checkoutError && (
        <p className="text-[13px]" style={{ color: 'var(--danger)' }}>
          {checkoutError}
        </p>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onBack} className="rounded-[3px]">
          Back
        </Button>
        <Button
          onClick={beginCheckout}
          disabled={!canCheckout || creatingOrder}
          className="rounded-[3px]"
          style={{ background: 'var(--vault)', color: 'var(--vault-ink)' }}
        >
          {creatingOrder ? 'Redirecting to Payfast…' : `Pay ${formatByRegion(total, region)}`}
        </Button>
      </div>
    </section>
  )
}
