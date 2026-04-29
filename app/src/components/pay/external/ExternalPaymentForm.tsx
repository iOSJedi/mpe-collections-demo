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
      color: '#1e293b',
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '16px',
      fontSmoothing: 'antialiased',
      '::placeholder': { color: '#94a3b8' },
    },
    invalid: { color: '#dc2626', iconColor: '#dc2626' },
  },
  hidePostalCode: false,
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
      setError(stripeError.message ?? 'Payment failed.')
      setLoading(false)
      return
    }

    if (paymentIntent?.status !== 'succeeded') {
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
        setError(data.error ?? 'Failed to record payment.')
        setLoading(false)
        return
      }

      const params = new URLSearchParams({
        amount: String(amount),
        invoice: invoiceNumber,
      })
      router.push(`/pay/external/success?${params.toString()}`)
    } catch {
      setError('Failed to record payment. Please contact support.')
      setLoading(false)
    }
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
