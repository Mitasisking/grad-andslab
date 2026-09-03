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
          theme: 'stripe',
          variables: {
            colorPrimary: '#B8862F',
            colorText: '#1C1B18',
            colorBackground: '#F5F2EA',
            borderRadius: '3px',
          },
        },
      }}
    >
      <InnerForm onSuccess={onSuccess} />
    </Elements>
  )
}
