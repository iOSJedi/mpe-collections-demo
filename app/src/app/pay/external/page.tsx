'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Elements } from '@stripe/react-stripe-js'
import { loadStripe, Appearance, Stripe } from '@stripe/stripe-js'
import { Loader2, ShieldCheck } from 'lucide-react'
import { ExternalPaymentForm } from '@/components/pay/external/ExternalPaymentForm'

interface VerifiedTokenData {
  amount: number
  invoiceNumber: string
  customerName: string
  dueDate?: string
  payerEmail?: string
  sessionId?: string
  callbackUrl?: string
  expiresAt: string
}

const appearance: Appearance = {
  theme: 'flat',
  variables: {
    colorPrimary: '#0E2C20',
    colorBackground: '#ffffff',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  rules: { '.Label': { color: '#383D36' } },
}

function defaultEmail(sessionId: string | undefined): string {
  if (sessionId && sessionId.trim()) {
    return `chatbot-${sessionId.trim()}@demo.local`
  }
  const rand = Math.random().toString(36).slice(2, 10)
  return `chatbot-${rand}@demo.local`
}

function ExternalPayPage() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null)
  const [verified, setVerified] = useState<VerifiedTokenData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [payerEmail, setPayerEmail] = useState('')
  const [payerName, setPayerName] = useState('')

  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [intentLoading, setIntentLoading] = useState(false)
  const [intentError, setIntentError] = useState<string | null>(null)

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    if (key) setStripePromise(loadStripe(key))
  }, [])

  useEffect(() => {
    if (!token) {
      setError('No payment token provided.')
      setLoading(false)
      return
    }

    async function verifyToken() {
      try {
        const res = await fetch('/api/external/payment-link/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        const json = await res.json()
        if (!res.ok) {
          setError(json.error ?? 'Invalid or expired payment link.')
          return
        }
        const data = json as VerifiedTokenData
        setVerified(data)
        setPayerEmail(data.payerEmail ?? defaultEmail(data.sessionId))
        setPayerName(data.customerName)
      } catch {
        setError('Failed to load payment details. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    verifyToken()
  }, [token])

  async function preparePaymentIntent() {
    if (!token || !verified) return
    setIntentLoading(true)
    setIntentError(null)
    setClientSecret(null)

    try {
      const res = await fetch('/api/external/payment-link/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, payerEmail }),
      })
      const json = await res.json()
      if (!res.ok) {
        setIntentError(json.error ?? 'Failed to initialize payment.')
        return
      }
      setClientSecret(json.clientSecret)
    } catch {
      setIntentError('Failed to initialize payment. Please try again.')
    } finally {
      setIntentLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F5EEDE' }}>
      <header className="px-6 py-4 shadow-md" style={{ backgroundColor: '#0E2C20' }}>
        <div className="max-w-md mx-auto flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/ali-access-logo.svg"
            alt="Ayala Land Access"
            className="h-9 w-9 rounded-md bg-white"
          />
          <span className="text-white font-bold text-base tracking-tight">
            Ayala Land Access
          </span>
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center py-8 px-4">
        <div className="w-full max-w-md">
          <div
            className="bg-white rounded-xl shadow-sm overflow-hidden border"
            style={{ borderColor: '#DDD4C9' }}
          >
            <div
              className="px-6 py-4 border-b"
              style={{ borderColor: '#DDD4C9', backgroundColor: 'rgba(14,44,32,0.05)' }}
            >
              <h1 className="text-lg font-semibold" style={{ color: '#0E2C20' }}>
                Payment Portal
              </h1>
            </div>

            <div className="p-6">
              {loading && (
                <div className="flex flex-col items-center gap-3 py-12">
                  <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#0E2C20' }} />
                  <p className="text-sm" style={{ color: '#383D36' }}>
                    Loading payment details...
                  </p>
                </div>
              )}

              {!loading && error && (
                <div className="py-8 text-center space-y-3">
                  <div
                    className="rounded-lg p-4 border"
                    style={{ backgroundColor: '#FEEFEA', borderColor: '#CE3106' }}
                  >
                    <p className="text-sm font-medium" style={{ color: '#CE3106' }}>
                      {error}
                    </p>
                  </div>
                </div>
              )}

              {!loading && !error && verified && (
                <div className="space-y-6">
                  <div
                    className="rounded-lg border p-4 space-y-2"
                    style={{ borderColor: '#DDD4C9', backgroundColor: '#F5EEDE' }}
                  >
                    <div className="flex justify-between text-sm">
                      <span style={{ color: '#383D36' }}>Invoice</span>
                      <span className="font-medium" style={{ color: '#0E2C20' }}>
                        {verified.invoiceNumber}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span style={{ color: '#383D36' }}>Customer</span>
                      <span className="font-medium" style={{ color: '#0E2C20' }}>
                        {verified.customerName}
                      </span>
                    </div>
                    {verified.dueDate && (
                      <div className="flex justify-between text-sm">
                        <span style={{ color: '#383D36' }}>Due Date</span>
                        <span className="font-medium" style={{ color: '#0E2C20' }}>
                          {verified.dueDate}
                        </span>
                      </div>
                    )}
                    <div
                      className="flex justify-between text-sm border-t pt-2"
                      style={{ borderColor: '#DDD4C9' }}
                    >
                      <span className="font-medium" style={{ color: '#383D36' }}>
                        Amount Due
                      </span>
                      <span
                        className="font-bold text-base"
                        style={{ color: '#0E2C20' }}
                      >
                        ₱{verified.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {!clientSecret && (
                    <div className="space-y-3">
                      <div>
                        <label
                          htmlFor="payer-email"
                          className="text-xs mb-1 block"
                          style={{ color: '#383D36' }}
                        >
                          Email (for receipt)
                        </label>
                        <input
                          id="payer-email"
                          type="email"
                          value={payerEmail}
                          onChange={(e) => setPayerEmail(e.target.value)}
                          className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E2C20]/30 focus:border-[#0E2C20]"
                          style={{ borderColor: '#DDD4C9', color: '#0E2C20' }}
                          placeholder="you@example.com"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="payer-name"
                          className="text-xs mb-1 block"
                          style={{ color: '#383D36' }}
                        >
                          Name on card
                        </label>
                        <input
                          id="payer-name"
                          type="text"
                          value={payerName}
                          onChange={(e) => setPayerName(e.target.value)}
                          className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E2C20]/30 focus:border-[#0E2C20]"
                          style={{ borderColor: '#DDD4C9', color: '#0E2C20' }}
                          placeholder="Cardholder name"
                        />
                      </div>

                      {intentError && (
                        <p
                          className="text-sm rounded-md px-3 py-2 border"
                          style={{ color: '#CE3106', borderColor: '#CE3106', backgroundColor: '#FEEFEA' }}
                        >
                          {intentError}
                        </p>
                      )}

                      <button
                        onClick={preparePaymentIntent}
                        disabled={intentLoading || !payerEmail.trim() || !payerName.trim()}
                        className="w-full py-3 rounded-lg text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:opacity-90"
                        style={{ backgroundColor: '#0E2C20' }}
                      >
                        {intentLoading ? 'Preparing...' : 'Continue to Card Payment'}
                      </button>
                    </div>
                  )}

                  {clientSecret && stripePromise && (
                    <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
                      <ExternalPaymentForm
                        clientSecret={clientSecret}
                        token={token!}
                        amount={verified.amount}
                        invoiceNumber={verified.invoiceNumber}
                        payerEmail={payerEmail}
                        payerName={payerName}
                      />
                    </Elements>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="py-4 px-4 text-center">
        <div
          className="flex items-center justify-center gap-2 text-xs"
          style={{ color: '#383D36' }}
        >
          <ShieldCheck className="h-3.5 w-3.5" style={{ color: '#0E2C20' }} />
          <span>Secured by Ayala Land Access</span>
        </div>
      </footer>
    </div>
  )
}

export default function ExternalPayPageWrapper() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen flex items-center justify-center"
          style={{ backgroundColor: '#F5EEDE' }}
        >
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#0E2C20' }} />
        </div>
      }
    >
      <ExternalPayPage />
    </Suspense>
  )
}
