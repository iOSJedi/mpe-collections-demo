'use client'

import { useState } from 'react'
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface StripeCardInputProps {
  clientSecret: string
  invoiceId: number
  amount: number
  onSuccess?: (paymentId: number, newBalance: number) => void
}

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      color: '#1e293b',
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '16px',
      fontSmoothing: 'antialiased',
      '::placeholder': {
        color: '#94a3b8',
      },
    },
    invalid: {
      color: '#dc2626',
      iconColor: '#dc2626',
    },
  },
  hidePostalCode: false,
}

export function StripeCardInput({ clientSecret, invoiceId, amount, onSuccess }: StripeCardInputProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

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

    // 1. Confirm the card payment with Stripe
    const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: { card: cardElement },
    })

    if (stripeError) {
      setError(stripeError.message ?? 'Payment failed.')
      setLoading(false)
      return
    }

    if (paymentIntent?.status !== 'succeeded') {
      setError('Payment was not completed. Please try again.')
      setLoading(false)
      return
    }

    // 2. Confirm payment on the server
    try {
      const res = await fetch('/api/pay/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentIntentId: paymentIntent.id,
          invoiceId,
          amount,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Failed to record payment.')
        setLoading(false)
        return
      }

      setSuccess(true)
      onSuccess?.(data.paymentId, data.newBalance)
    } catch {
      setError('Failed to record payment. Please contact support.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <CheckCircle2 className="h-12 w-12 text-green-600" />
        <p className="text-lg font-semibold text-green-700">Payment Successful!</p>
        <p className="text-sm text-slate-500">
          Your payment has been processed and confirmed.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <CardElement options={CARD_ELEMENT_OPTIONS} />
      </div>

      {error && (
        <p className="text-sm text-red-600 rounded-md bg-red-50 border border-red-200 px-3 py-2">
          {error}
        </p>
      )}

      <Button
        onClick={handlePay}
        disabled={!stripe || loading}
        className="w-full bg-[#003B1F] hover:bg-[#003B1F]/90 text-white"
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

      <p className="text-xs text-center text-slate-400">
        Secured by Stripe. Card details are never stored on our servers.
      </p>
    </div>
  )
}
