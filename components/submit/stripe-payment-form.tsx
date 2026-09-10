'use client'

import { type FormEvent, useState } from 'react'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { Button } from '@/components/ui/button'
import { getStripe } from '@/lib/stripe-client'

function InnerForm({ onSuccess }: { onSuccess: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return

    setSubmitting(true)
    setError(null)

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    })

    if (confirmError) {
      setError(confirmError.message ?? 'Payment failed. Check your details and try again.')
      setSubmitting(false)
      return
    }

    setSubmitting(false)
    onSuccess()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && (
        <p className="text-[13px]" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}
      <Button
        type="submit"
        disabled={!stripe || submitting}
        className="w-full rounded-[3px]"
        style={{ background: 'var(--seal)', color: 'var(--seal-ink)' }}
      >
        {submitting ? 'Processing…' : 'Pay & submit'}
      </Button>
    </form>
  )
}

export function StripePaymentForm({ clientSecret, onSuccess }: { clientSecret: string; onSuccess: () => void }) {
  return (
    <Elements
      stripe={getStripe()}
      options={{
        clientSecret,
        appearance: {
          // 'night' as the base, not 'stripe' -- the variables below only
          // override specific tokens, and 'stripe' assumes a light page
          // around them for the rest (borders, placeholder text) that
          // 'night' gets right by default against the app's dark theme
          // (app/globals.css's --paper/--ink, which this can't reference
          // directly since Stripe Elements takes real hex, not CSS vars).
          theme: 'night',
          variables: {
            colorPrimary: '#a67c00',
            colorText: '#F3EFE4',
            colorBackground: '#1D1812',
            colorDanger: '#E2645A',
            borderRadius: '3px',
          },
        },
      }}
    >
      <InnerForm onSuccess={onSuccess} />
    </Elements>
  )
}
