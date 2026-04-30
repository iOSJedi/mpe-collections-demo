'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ExternalPaymentFormProps {
  clientSecret: string
  token: string
  amount: number
  invoiceNumber: string
  payerEmail: string
  payerName: string
}

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      color: '#0E2C20',
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '16px',
      fontSmoothing: 'antialiased',
      '::placeholder': { color: '#383D36' },
    },
    invalid: { color: '#CE3106', iconColor: '#CE3106' },
  },
  hidePostalCode: false,
}

function notifyFailure(token: string, errorMessage: string) {
  fetch('/api/external/payment-link/notify-failure', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, errorMessage }),
  }).catch(() => {
    // Fire-and-forget; do not surface this to the user.
  })
}

export function ExternalPaymentForm({
  clientSecret,
  token,
  amount,
  invoiceNumber,
  payerEmail,
  payerName,
}: ExternalPaymentFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handlePay() {
    if (!stripe || !elements) return
    setLoading(true)
    setError(null)

    const cardElement = elements.getElement(CardElement)
    if (!cardElement) {
      setError('Card element not found.')
      setLoading(false)
      return
    }

    const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
      clientSecret,
      { payment_method: { card: cardElement, billing_details: { email: payerEmail, name: payerName } } }
    )

    if (stripeError) {
      const msg = stripeError.message ?? 'Payment failed.'
      notifyFailure(token, msg)
      setError(msg)
      setLoading(false)
      return
    }

    if (paymentIntent?.status !== 'succeeded') {
      const msg = `Payment was not completed. Status: ${paymentIntent?.status ?? 'unknown'}`
      notifyFailure(token, msg)
      setError('Payment was not completed. Please try again.')
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/external/payment-link/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          paymentIntentId: paymentIntent.id,
          payerEmail,
          payerName,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg = data.error ?? 'Failed to record payment.'
        notifyFailure(token, msg)
        setError(msg)
        setLoading(false)
        return
      }

      const params = new URLSearchParams({
        amount: String(amount),
        invoice: invoiceNumber,
      })
      router.push(`/pay/external/success?${params.toString()}`)
    } catch {
      const msg = 'Failed to record payment. Please contact support.'
      notifyFailure(token, msg)
      setError(msg)
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div
        className="rounded-lg border bg-white p-4"
        style={{ borderColor: '#DDD4C9' }}
      >
        <CardElement options={CARD_ELEMENT_OPTIONS} />
      </div>

      {error && (
        <p
          className="text-sm rounded-md px-3 py-2 border"
          style={{ color: '#CE3106', borderColor: '#CE3106', backgroundColor: '#FEEFEA' }}
        >
          {error}
        </p>
      )}

      <Button
        onClick={handlePay}
        disabled={!stripe || loading}
        className="w-full text-white hover:opacity-90"
        style={{ backgroundColor: '#0E2C20' }}
        size="lg"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          `Pay ₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        )}
      </Button>

      <p className="text-xs text-center" style={{ color: '#383D36' }}>
        Secured by Stripe. Card details are never stored on our servers.
      </p>
    </div>
  )
}
