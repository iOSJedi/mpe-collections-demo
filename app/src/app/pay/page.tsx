'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { PaymentPageData, InvoiceBreakdownItem } from '@/types'
import { PaymentForm } from '@/components/pay/PaymentForm'
import { BalanceBreakdown } from '@/components/pay/BalanceBreakdown'
import { PartialPaymentCalculator } from '@/components/pay/PartialPaymentCalculator'
import { CheckPaymentFlow } from '@/components/pay/CheckPaymentFlow'
import { Loader2, ShieldCheck, CreditCard, Building2, FileCheck } from 'lucide-react'

interface BreakdownTotals {
  totalPrincipal: number
  totalPenalties: number
  totalPaid: number
  grandTotalDue: number
}

interface PaymentState {
  data: PaymentPageData
  invoiceId: number
  customerId: number
  breakdown: {
    invoices: InvoiceBreakdownItem[]
    totals: BreakdownTotals
  } | null
  penaltyRate: number
}

type PortalView = 'breakdown' | 'full' | 'partial' | 'check'
type PaymentMethodChoice = 'card' | 'check'

function PayPage() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [state, setState] = useState<PaymentState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<PortalView>('breakdown')
  const [partialAmount, setPartialAmount] = useState<number | null>(null)
  const [methodChoice, setMethodChoice] = useState<PaymentMethodChoice>('card')

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

        const paymentData: PaymentPageData = {
          invoice_number: json.invoice_number,
          contract_number: json.contract_number,
          account_number: json.account_number,
          customer_name: json.customer_name,
          due_date: json.due_date,
          amount: json.amount,
          balance_remaining: json.balance_remaining,
        }

        // Also load breakdown (unauthenticated — verified by the same token)
        let breakdownData: PaymentState['breakdown'] = null
        let penaltyRate = 2 // default
        try {
          const bdRes = await fetch('/api/pay/breakdown', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ customerId: json.customerId, token }),
          })
          if (bdRes.ok) {
            const bd = await bdRes.json()
            breakdownData = { invoices: bd.invoices, totals: bd.totals }
            // Infer penalty rate from first active penalty if available
            const firstPenalty = bd.invoices
              ?.flatMap((inv: InvoiceBreakdownItem) => inv.penalties)
              ?.find((p: InvoiceBreakdownItem['penalties'][number]) => p.status === 'ACTIVE')
            if (firstPenalty?.penaltyRate) {
              penaltyRate = firstPenalty.penaltyRate
            }
          }
        } catch {
          // Non-fatal: breakdown unavailable, fall through to basic PaymentForm
        }

        setState({
          data: paymentData,
          invoiceId: json.invoiceId,
          customerId: json.customerId,
          breakdown: breakdownData,
          penaltyRate,
        })
      } catch {
        setError('Failed to load payment details. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    loadPaymentData()
  }, [token])

  // Derived payment data adjusted for partial amount
  function getPaymentFormData(): PaymentPageData {
    if (!state) return {} as PaymentPageData
    if (partialAmount !== null) {
      return { ...state.data, balance_remaining: partialAmount }
    }
    // For full payment, use grandTotalDue if breakdown available
    if (state.breakdown) {
      return { ...state.data, balance_remaining: state.breakdown.totals.grandTotalDue }
    }
    return state.data
  }

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
              <p className="text-xs text-slate-500 mt-0.5">
                {view === 'breakdown' && 'Review your outstanding balance'}
                {view === 'full' && methodChoice === 'card' && 'Secure online payment for your invoice'}
                {view === 'full' && methodChoice === 'check' && 'Pay by check · Deposit slip required'}
                {view === 'partial' && 'Choose a partial payment amount'}
                {view === 'check' && 'Pay by check · Deposit slip required'}
              </p>
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
                <>
                  {/* Breakdown view — shown first */}
                  {view === 'breakdown' && state.breakdown && (
                    <BalanceBreakdown
                      invoices={state.breakdown.invoices}
                      totals={state.breakdown.totals}
                      onPayFull={() => {
                        setPartialAmount(null)
                        setView('full')
                      }}
                      onPayPartial={() => {
                        setPartialAmount(null)
                        setView('partial')
                      }}
                    />
                  )}

                  {/* If breakdown unavailable, go straight to payment form */}
                  {view === 'breakdown' && !state.breakdown && (
                    <PaymentForm
                      data={state.data}
                      invoiceId={state.invoiceId}
                      customerId={state.customerId}
                      token={token!}
                    />
                  )}

                  {/* Partial payment calculator */}
                  {view === 'partial' && (
                    <PartialPaymentCalculator
                      customerId={state.customerId}
                      totalDue={state.breakdown?.totals.grandTotalDue ?? state.data.balance_remaining}
                      penaltyRate={state.penaltyRate}
                      onBack={() => setView('breakdown')}
                      onPay={(amount) => {
                        setPartialAmount(amount)
                        setView('full')
                      }}
                    />
                  )}

                  {/* Payment form (full or partial amount) */}
                  {view === 'full' && (
                    <div className="space-y-4">
                      {/* Back link */}
                      <button
                        onClick={() => {
                          setPartialAmount(null)
                          setView('breakdown')
                        }}
                        className="text-xs text-[#003B1F] hover:underline"
                      >
                        ← Back to balance summary
                      </button>

                      {/* Payment method selection */}
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-slate-700">Payment Method</p>
                        <div className="grid grid-cols-1 gap-2">
                          {/* Card/Bank option */}
                          <button
                            onClick={() => setMethodChoice('card')}
                            className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                              methodChoice === 'card'
                                ? 'border-[#003B1F] bg-[#003B1F]/5'
                                : 'border-slate-200 hover:border-slate-300 bg-white'
                            }`}
                          >
                            <CreditCard className={`h-5 w-5 flex-shrink-0 ${methodChoice === 'card' ? 'text-[#003B1F]' : 'text-slate-400'}`} />
                            <div>
                              <p className={`text-sm font-medium ${methodChoice === 'card' ? 'text-[#003B1F]' : 'text-slate-700'}`}>
                                Card / Bank Transfer
                              </p>
                              <p className="text-xs text-slate-500">Credit card or BPI online transfer</p>
                            </div>
                          </button>

                          {/* Check option */}
                          <button
                            onClick={() => setMethodChoice('check')}
                            className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                              methodChoice === 'check'
                                ? 'border-[#003B1F] bg-[#003B1F]/5'
                                : 'border-slate-200 hover:border-slate-300 bg-white'
                            }`}
                          >
                            <FileCheck className={`h-5 w-5 flex-shrink-0 ${methodChoice === 'check' ? 'text-[#003B1F]' : 'text-slate-400'}`} />
                            <div>
                              <p className={`text-sm font-medium ${methodChoice === 'check' ? 'text-[#003B1F]' : 'text-slate-700'}`}>
                                Check Payment
                              </p>
                              <p className="text-xs text-slate-500">Deposit check + upload slip · 3-day clearing</p>
                            </div>
                          </button>
                        </div>
                      </div>

                      {/* Render card/bank form or check flow */}
                      {methodChoice === 'card' ? (
                        <PaymentForm
                          data={getPaymentFormData()}
                          invoiceId={state.invoiceId}
                          customerId={state.customerId}
                          token={token!}
                        />
                      ) : (
                        <CheckPaymentFlow
                          customerId={state.customerId}
                          invoiceId={state.invoiceId}
                          amount={getPaymentFormData().balance_remaining}
                          onComplete={() => setView('breakdown')}
                        />
                      )}
                    </div>
                  )}
                </>
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
