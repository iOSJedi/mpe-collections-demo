'use client'

import { useState, useEffect } from 'react'
import { Elements } from '@stripe/react-stripe-js'
import { loadStripe, Appearance, Stripe } from '@stripe/stripe-js'
import { PaymentPageData } from '@/types'
import { StripeCardInput } from './StripeCardInput'
import { BPITransfer } from './BPITransfer'

interface PaymentFormProps {
  data: PaymentPageData
  invoiceId: number
  customerId: number
  token: string
}

const appearance: Appearance = {
  theme: 'flat',
  variables: {
    colorPrimary: '#003B1F',
    colorBackground: '#ffffff',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  rules: {
    '.Label': { color: '#64748b' },
  },
}

type PaymentMode = 'full' | 'partial'
type PaymentMethod = 'card' | 'bpi'

export function PaymentForm({ data, invoiceId, customerId, token }: PaymentFormProps) {
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null)
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('full')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card')
  const [partialAmount, setPartialAmount] = useState<string>(String(data.balance_remaining))
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null)
  const [loadingIntent, setLoadingIntent] = useState(false)
  const [intentError, setIntentError] = useState<string | null>(null)
  const [newBalance, setNewBalance] = useState<number | null>(null)

  // Load Stripe lazily on client
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    if (key) {
      setStripePromise(loadStripe(key))
    }
  }, [])

  const effectiveAmount =
    paymentMode === 'full'
      ? data.balance_remaining
      : Math.min(parseFloat(partialAmount) || 0, data.balance_remaining)

  const isAmountValid =
    effectiveAmount > 0 && effectiveAmount <= data.balance_remaining

  // When payment method is card, create/refresh PaymentIntent whenever amount changes
  async function preparePaymentIntent() {
    if (!isAmountValid) return
    setLoadingIntent(true)
    setIntentError(null)
    setClientSecret(null)

    try {
      const res = await fetch('/api/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, amount: effectiveAmount }),
      })
      const json = await res.json()
      if (!res.ok) {
        setIntentError(json.error ?? 'Failed to initialize payment.')
        return
      }
      setClientSecret(json.clientSecret)
      setPaymentIntentId(json.paymentIntentId)
    } catch {
      setIntentError('Failed to initialize payment. Please try again.')
    } finally {
      setLoadingIntent(false)
    }
  }

  function handlePaymentMethodChange(method: PaymentMethod) {
    setPaymentMethod(method)
    setClientSecret(null)
    setIntentError(null)
  }

  function handleConfirmPay() {
    if (paymentMethod === 'card') {
      preparePaymentIntent()
    }
  }

  function handlePaymentSuccess(pid: number, nb: number) {
    setNewBalance(nb)
  }

  const displayBalance =
    newBalance !== null ? newBalance : data.balance_remaining

  return (
    <div className="space-y-6">
      {/* Invoice summary */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Invoice</span>
          <span className="font-medium text-slate-800">{data.invoice_number}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Customer</span>
          <span className="font-medium text-slate-800">{data.customer_name}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Invoice Amount</span>
          <span className="font-medium text-slate-800">
            ₱{data.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex justify-between text-sm border-t border-slate-200 pt-2">
          <span className="text-slate-600 font-medium">Balance Due</span>
          <span className="font-bold text-[#003B1F] text-base">
            ₱{displayBalance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Due Date</span>
          <span className="font-medium text-slate-800">{data.due_date}</span>
        </div>
      </div>

      {/* Full / Partial toggle */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-700">Payment Amount</p>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="paymentMode"
              value="full"
              checked={paymentMode === 'full'}
              onChange={() => {
                setPaymentMode('full')
                setClientSecret(null)
                setIntentError(null)
              }}
              className="accent-[#003B1F]"
            />
            <span className="text-sm text-slate-700">
              Full amount — ₱{data.balance_remaining.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="paymentMode"
              value="partial"
              checked={paymentMode === 'partial'}
              onChange={() => {
                setPaymentMode('partial')
                setClientSecret(null)
                setIntentError(null)
              }}
              className="accent-[#003B1F]"
            />
            <span className="text-sm text-slate-700">Partial payment</span>
          </label>
        </div>

        {paymentMode === 'partial' && (
          <div className="mt-2">
            <label className="text-xs text-slate-500 mb-1 block">
              Enter amount (max: ₱{data.balance_remaining.toLocaleString('en-PH', { minimumFractionDigits: 2 })})
            </label>
            <input
              type="number"
              min="1"
              max={data.balance_remaining}
              step="0.01"
              value={partialAmount}
              onChange={(e) => {
                setPartialAmount(e.target.value)
                setClientSecret(null)
                setIntentError(null)
              }}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003B1F]/30 focus:border-[#003B1F]"
              placeholder="0.00"
            />
            {paymentMode === 'partial' && parseFloat(partialAmount) > data.balance_remaining && (
              <p className="text-xs text-red-500 mt-1">Amount cannot exceed balance remaining.</p>
            )}
            {paymentMode === 'partial' && parseFloat(partialAmount) <= 0 && (
              <p className="text-xs text-red-500 mt-1">Amount must be greater than zero.</p>
            )}
          </div>
        )}
      </div>

      {/* Payment method tabs */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-slate-700">Payment Method</p>
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          <button
            onClick={() => handlePaymentMethodChange('card')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              paymentMethod === 'card'
                ? 'bg-[#003B1F] text-white'
                : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            Credit / Debit Card
          </button>
          <button
            onClick={() => handlePaymentMethodChange('bpi')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              paymentMethod === 'bpi'
                ? 'bg-[#003B1F] text-white'
                : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            BPI Transfer
          </button>
        </div>
      </div>

      {/* Payment inputs */}
      {paymentMethod === 'card' && (
        <div className="space-y-3">
          {!clientSecret ? (
            <>
              {intentError && (
                <p className="text-sm text-red-600 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                  {intentError}
                </p>
              )}
              <button
                onClick={handleConfirmPay}
                disabled={!isAmountValid || loadingIntent}
                className="w-full py-3 rounded-lg bg-[#003B1F] hover:bg-[#003B1F]/90 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loadingIntent ? 'Preparing...' : 'Continue to Card Payment'}
              </button>
            </>
          ) : stripePromise ? (
            <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
              <StripeCardInput
                clientSecret={clientSecret}
                invoiceId={invoiceId}
                amount={effectiveAmount}
                onSuccess={handlePaymentSuccess}
              />
            </Elements>
          ) : (
            <p className="text-sm text-slate-500">Loading payment form...</p>
          )}
        </div>
      )}

      {paymentMethod === 'bpi' && (
        <BPITransfer customerId={customerId} invoiceId={invoiceId} qrToken={token} />
      )}
    </div>
  )
}
