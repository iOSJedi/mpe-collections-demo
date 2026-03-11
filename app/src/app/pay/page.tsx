'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { PaymentPageData } from '@/types'
import { PaymentForm } from '@/components/pay/PaymentForm'
import { Loader2, ShieldCheck } from 'lucide-react'

interface PaymentState {
  data: PaymentPageData
  invoiceId: number
  customerId: number
}

function PayPage() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [state, setState] = useState<PaymentState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setError('No payment token provided. Please scan the QR code again.')
      setLoading(false)
      return
    }

    async function loadPaymentData() {
      try {
        // Verify token and fetch payment data + IDs in one request
        const res = await fetch('/api/pay/meta', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })

        const json = await res.json()

        if (!res.ok) {
          setError(json.error ?? 'Invalid or expired payment link.')
          return
        }

        setState({
          data: {
            invoice_number: json.invoice_number,
            contract_number: json.contract_number,
            account_number: json.account_number,
            customer_name: json.customer_name,
            due_date: json.due_date,
            amount: json.amount,
            balance_remaining: json.balance_remaining,
          },
          invoiceId: json.invoiceId,
          customerId: json.customerId,
        })
      } catch {
        setError('Failed to load payment details. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    loadPaymentData()
  }, [token])

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Header */}
      <header className="bg-[#003B1F] px-6 py-4 shadow-md">
        <div className="max-w-md mx-auto">
          <span className="text-[#C9A84C] font-bold text-xl tracking-widest uppercase">
            AYALA LAND
          </span>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-start justify-center py-8 px-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-[#003B1F]/5 border-b border-slate-200 px-6 py-4">
              <h1 className="text-lg font-semibold text-[#003B1F]">Payment Portal</h1>
              <p className="text-xs text-slate-500 mt-0.5">Secure online payment for your invoice</p>
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
                  <p className="text-xs text-slate-500">
                    If you believe this is an error, please contact your account manager.
                  </p>
                </div>
              )}

              {!loading && !error && state && (
                <PaymentForm
                  data={state.data}
                  invoiceId={state.invoiceId}
                  customerId={state.customerId}
                  token={token!}
                />
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 px-4 text-center">
        <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5 text-[#003B1F]" />
          <span>Secured by Ayala Land Collections Portal</span>
        </div>
      </footer>
    </div>
  )
}

export default function PayPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#003B1F]" />
        </div>
      }
    >
      <PayPage />
    </Suspense>
  )
}
