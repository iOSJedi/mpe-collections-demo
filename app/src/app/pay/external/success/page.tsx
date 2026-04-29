'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, ShieldCheck, Loader2 } from 'lucide-react'

function SuccessPage() {
  const searchParams = useSearchParams()
  const amount = searchParams.get('amount')
  const invoice = searchParams.get('invoice')

  const parsedAmount = amount ? Number(amount) : NaN
  const amountDisplay = Number.isFinite(parsedAmount)
    ? `₱${parsedAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
    : null

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
            <div className="p-8 flex flex-col items-center gap-3 text-center">
              <CheckCircle2 className="h-14 w-14 text-green-600" />
              <h1 className="text-xl font-semibold text-[#003B1F]">Payment Successful</h1>
              {amountDisplay && (
                <p className="text-2xl font-bold text-[#003B1F]">{amountDisplay}</p>
              )}
              {invoice && (
                <p className="text-sm text-slate-500">Invoice {invoice}</p>
              )}
              <p className="text-sm text-slate-500 mt-2">
                Your payment has been processed and confirmed. A receipt has been emailed
                to the address you provided.
              </p>
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

export default function SuccessPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#003B1F]" />
        </div>
      }
    >
      <SuccessPage />
    </Suspense>
  )
}
