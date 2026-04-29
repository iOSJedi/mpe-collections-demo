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
  expiresAt: string
}

const appearance: Appearance = {
  theme: 'flat',
  variables: {
    colorPrimary: '#003B1F',
    colorBackground: '#ffffff',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  rules: { '.Label': { color: '#64748b' } },
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

  // Load Stripe lazily on the client.
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    if (key) setStripePromise(loadStripe(key))
  }, [])

  // Verify the token once on mount.
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
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="bg-[#003B1F] px-6 py-4 shadow-md">
        <div className="max-w-md mx-auto">
          <span className="text-[#C9A84C] font-bold text-xl tracking-widest uppercase">
            AYALA LAND
          </span>
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center py-8 px-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-[#003B1F]/5 border-b border-slate-200 px-6 py-4">
              <h1 className="text-lg font-semibold text-[#003B1F]">Payment Portal</h1>
              <p className="text-xs text-slate-500 mt-0.5">Secure checkout via chatbot link</p>
            </div>

            <div className="p-6">
              {loading && (
                <div className="flex flex-col items-center gap-3 py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-[#003B1F]" />
                  <p className="text-sm text-slate-500">Loading payment details...</p>
                </div>
              )}

              {!loading && error && (
                <div className="py-8 text-center space-y-3">
                  <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                    <p className="text-sm text-red-700 font-medium">{error}</p>
                  </div>
                </div>
              )}

              {!loading && !error && verified && (
                <div className="space-y-6">
                  {/* Summary */}
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Invoice</span>
                      <span className="font-medium text-slate-800">{verified.invoiceNumber}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Customer</span>
                      <span className="font-medium text-slate-800">{verified.customerName}</span>
                    </div>
                    {verified.dueDate && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Due Date</span>
                        <span className="font-medium text-slate-800">{verified.dueDate}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm border-t border-slate-200 pt-2">
                      <span className="text-slate-600 font-medium">Amount Due</span>
                      <span className="font-bold text-[#003B1F] text-base">
                        ₱{verified.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* Payer info */}
                  {!clientSecret && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Email (for receipt)</label>
                        <input
                          type="email"
                          value={payerEmail}
                          onChange={(e) => setPayerEmail(e.target.value)}
                          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003B1F]/30 focus:border-[#003B1F]"
                          placeholder="you@example.com"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Name on card</label>
                        <input
                          type="text"
                          value={payerName}
                          onChange={(e) => setPayerName(e.target.value)}
                          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003B1F]/30 focus:border-[#003B1F]"
                          placeholder="Cardholder name"
                        />
                      </div>

                      {intentError && (
                        <p className="text-sm text-red-600 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                          {intentError}
                        </p>
                      )}

                      <button
                        onClick={preparePaymentIntent}
                        disabled={intentLoading || !payerEmail.trim()}
                        className="w-full py-3 rounded-lg bg-[#003B1F] hover:bg-[#003B1F]/90 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {intentLoading ? 'Preparing...' : 'Continue to Card Payment'}
                      </button>
                    </div>
                  )}

                  {/* Stripe form */}
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
        <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5 text-[#003B1F]" />
          <span>Secured by Ayala Land Collections Portal</span>
        </div>
      </footer>
    </div>
  )
}

export default function ExternalPayPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#003B1F]" />
        </div>
      }
    >
      <ExternalPayPage />
    </Suspense>
  )
}
