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
            <div className="p-8 flex flex-col items-center gap-3 text-center">
              <CheckCircle2 className="h-14 w-14" style={{ color: '#0E2C20' }} />
              <h1 className="text-xl font-semibold" style={{ color: '#0E2C20' }}>
                Payment Successful
              </h1>
              {amountDisplay && (
                <p className="text-2xl font-bold" style={{ color: '#0E2C20' }}>
                  {amountDisplay}
                </p>
              )}
              {invoice && (
                <p className="text-sm" style={{ color: '#383D36' }}>
                  Invoice {invoice}
                </p>
              )}
              <p className="text-sm mt-2" style={{ color: '#383D36' }}>
                Your payment has been processed and confirmed. A receipt has been emailed
                to the address you provided.
              </p>
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

export default function SuccessPageWrapper() {
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
      <SuccessPage />
    </Suspense>
  )
}
