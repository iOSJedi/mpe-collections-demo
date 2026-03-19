'use client'

import { useState, useEffect, useRef } from 'react'
import { AllocationPreview } from '@/types'
import { Loader2 } from 'lucide-react'

interface PartialPaymentCalculatorProps {
  customerId: number
  totalDue: number
  penaltyRate: number
  onPay: (amount: number) => void
  onBack?: () => void
}

function formatPHP(amount: number): string {
  return amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function PartialPaymentCalculator({
  customerId,
  totalDue,
  penaltyRate,
  onPay,
  onBack,
}: PartialPaymentCalculatorProps) {
  const [inputValue, setInputValue] = useState<string>('')
  const [preview, setPreview] = useState<AllocationPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const parsedAmount = parseFloat(inputValue) || 0
  const isValid = parsedAmount > 0 && parsedAmount <= totalDue

  // Debounced preview fetch
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!isValid) {
      setPreview(null)
      setError(null)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/pay/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customerId, amount: parsedAmount }),
        })
        const json = await res.json()
        if (!res.ok) {
          setError(json.error ?? 'Could not calculate allocation.')
          setPreview(null)
          return
        }
        setPreview(json as AllocationPreview)
      } catch {
        setError('Failed to calculate preview. Please try again.')
        setPreview(null)
      } finally {
        setLoading(false)
      }
    }, 500)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputValue, customerId])

  const monthlyAccrual = preview
    ? preview.monthlyPenaltyAccrual
    : Math.round(totalDue * (penaltyRate / 100) * 100) / 100

  return (
    <div className="space-y-5">
      {/* Back link */}
      {onBack && (
        <button
          onClick={onBack}
          className="text-xs text-[#003B1F] hover:underline flex items-center gap-1"
        >
          ← Back to balance summary
        </button>
      )}

      <div>
        <h2 className="text-sm font-semibold text-[#003B1F] mb-1">Partial Payment</h2>
        <p className="text-xs text-slate-500">
          Enter the amount you want to pay. We&apos;ll show you exactly how it will be applied.
        </p>
      </div>

      {/* Amount input */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-600">
          Payment amount (max: ₱{formatPHP(totalDue)})
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500">₱</span>
          <input
            type="number"
            min="1"
            max={totalDue}
            step="0.01"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="0.00"
            className="w-full rounded-lg border border-slate-300 pl-7 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003B1F]/30 focus:border-[#003B1F]"
          />
        </div>
        {inputValue && parsedAmount > totalDue && (
          <p className="text-xs text-red-500">Amount cannot exceed total due of ₱{formatPHP(totalDue)}.</p>
        )}
        {inputValue && parsedAmount <= 0 && (
          <p className="text-xs text-red-500">Amount must be greater than zero.</p>
        )}
      </div>

      {/* Allocation preview */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-6 text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-xs">Calculating allocation...</span>
        </div>
      )}

      {!loading && error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}

      {!loading && preview && isValid && (
        <div className="space-y-3">
          {/* Applied section */}
          {preview.applied.length > 0 && (
            <div className="rounded-lg border border-green-200 bg-green-50 overflow-hidden">
              <div className="px-3 py-2 border-b border-green-200 bg-green-100">
                <p className="text-xs font-semibold text-green-800">
                  How your payment will be applied
                </p>
              </div>
              <div className="divide-y divide-green-100">
                {preview.applied.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-start px-3 py-2 text-xs">
                    <div className="text-green-700">
                      <span className="font-medium">{item.invoiceNumber}</span>
                      <span className="ml-1 text-green-600">
                        — {item.allocationType === 'PENALTY'
                          ? `Late penalty${item.periodLabel ? ` (${item.periodLabel})` : ''}`
                          : 'Principal'}
                      </span>
                    </div>
                    <span className="font-semibold text-green-800 shrink-0 ml-2">
                      ₱{formatPHP(item.amount)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between px-3 py-2 border-t border-green-200 bg-green-100">
                <span className="text-xs font-semibold text-green-800">Total applied</span>
                <span className="text-xs font-bold text-green-800">₱{formatPHP(preview.totalApplied)}</span>
              </div>
            </div>
          )}

          {/* Remaining section */}
          {preview.remaining.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 overflow-hidden">
              <div className="px-3 py-2 border-b border-red-200 bg-red-100">
                <p className="text-xs font-semibold text-red-800">Still outstanding</p>
              </div>
              <div className="divide-y divide-red-100">
                {preview.remaining.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-start px-3 py-2 text-xs">
                    <div className="text-red-700">
                      <span className="font-medium">{item.invoiceNumber}</span>
                      <span className="ml-1 text-red-600">
                        — {item.type === 'PENALTY'
                          ? `Late penalty${item.periodLabel ? ` (${item.periodLabel})` : ''}`
                          : 'Principal'}
                      </span>
                    </div>
                    <span className="font-semibold text-red-800 shrink-0 ml-2">
                      ₱{formatPHP(item.amount)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between px-3 py-2 border-t border-red-200 bg-red-100">
                <span className="text-xs font-semibold text-red-800">Total remaining</span>
                <span className="text-xs font-bold text-red-800">₱{formatPHP(preview.totalRemaining)}</span>
              </div>
            </div>
          )}

          {/* Penalty warning */}
          {preview.totalRemaining > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
              <p className="text-xs text-amber-800">
                <span className="font-semibold">Heads up:</span>{' '}
                Remaining balance of{' '}
                <span className="font-semibold">₱{formatPHP(preview.totalRemaining)}</span>{' '}
                will continue to accrue penalties at{' '}
                <span className="font-semibold">{penaltyRate}%/month</span>{' '}
                (≈<span className="font-semibold">₱{formatPHP(monthlyAccrual)}/month</span>).
              </p>
            </div>
          )}
        </div>
      )}

      {/* Pay button */}
      <button
        onClick={() => onPay(parsedAmount)}
        disabled={!isValid || loading}
        className="w-full py-3 rounded-lg bg-[#003B1F] hover:bg-[#003B1F]/90 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
      >
        {isValid ? `Pay ₱${formatPHP(parsedAmount)}` : 'Enter a valid amount'}
      </button>
    </div>
  )
}
