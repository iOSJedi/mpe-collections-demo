'use client'

import { useState } from 'react'
import { apiFetch } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'

interface CheckPayment {
  paymentId: number
  checkNumber: string | null
  paymentDate: string
  clearanceDate: string | null
  status: string
  amount: number
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function getDaysElapsed(paymentDate: string): number {
  const deposited = new Date(paymentDate)
  const now = new Date()
  const diff = Math.floor((now.getTime() - deposited.getTime()) / 86400000)
  return Math.min(Math.max(diff, 0), 3)
}

function getClearanceText(daysElapsed: number): string {
  const remaining = 3 - daysElapsed
  if (remaining <= 0) return '3 of 3 days elapsed — clearing now'
  if (remaining === 1) return `${daysElapsed} of 3 days elapsed — clears tomorrow`
  return `${daysElapsed} of 3 days elapsed — clears in ${remaining} days`
}

export function CheckClearanceCard({ payment, onActionComplete }: {
  payment: CheckPayment
  onActionComplete?: () => void
}) {
  const [loading, setLoading] = useState<'confirm' | 'bounce' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isTerminal = payment.status === 'CONFIRMED' || payment.status === 'BOUNCED'
  const isPendingClearance = payment.status === 'PENDING_CLEARANCE'

  const daysElapsed = isPendingClearance ? getDaysElapsed(payment.paymentDate) : 0
  const progressPct = Math.round((daysElapsed / 3) * 100)

  async function handleAction(action: 'confirm' | 'bounce') {
    setLoading(action)
    setError(null)
    try {
      const res = await apiFetch(
        `/api/receivable/payments/${payment.paymentId}/check-action`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        }
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Request failed: ${res.status}`)
      }
      onActionComplete?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div
      className="mt-2 rounded-lg border px-4 py-3 space-y-3"
      style={{ borderColor: '#C5A930', backgroundColor: '#1a1608' }}
    >
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* CHECK method badge */}
          <span
            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold"
            style={{ backgroundColor: '#C5A930', color: '#1a1200' }}
          >
            CHECK
          </span>

          {/* Terminal status badges */}
          {payment.status === 'CONFIRMED' && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-green-600 text-white">
              CLEARED
            </span>
          )}
          {payment.status === 'BOUNCED' && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-600 text-white">
              BOUNCED
            </span>
          )}
          {isPendingClearance && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
              PENDING CLEARANCE
            </span>
          )}
        </div>
        <span className="text-sm font-bold" style={{ color: '#C5A930' }}>
          {formatCurrency(payment.amount)}
        </span>
      </div>

      {/* Check details */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
        <div>
          <span className="text-slate-400">Check No.: </span>
          <span className="font-mono text-slate-200">{payment.checkNumber ?? '—'}</span>
        </div>
        <div>
          <span className="text-slate-400">Deposit Date: </span>
          <span className="text-slate-200">{formatDate(payment.paymentDate)}</span>
        </div>
        <div>
          <span className="text-slate-400">Expected Clearance: </span>
          <span className="text-slate-200">{formatDate(payment.clearanceDate)}</span>
        </div>
      </div>

      {/* Clearance progress bar — only when pending */}
      {isPendingClearance && (
        <div className="space-y-1">
          <div className="h-2 rounded-full overflow-hidden bg-slate-700">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${progressPct}%`,
                background: 'linear-gradient(to right, #22c55e, #f59e0b)',
              }}
            />
          </div>
          <p className="text-xs text-slate-400">{getClearanceText(daysElapsed)}</p>
        </div>
      )}

      {/* Action buttons — only when pending clearance */}
      {isPendingClearance && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleAction('confirm')}
            disabled={loading !== null}
            className="px-3 py-1.5 rounded text-xs font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {loading === 'confirm' ? 'Confirming…' : 'Confirm Early'}
          </button>
          <button
            onClick={() => handleAction('bounce')}
            disabled={loading !== null}
            className="px-3 py-1.5 rounded text-xs font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {loading === 'bounce' ? 'Processing…' : 'Mark Bounced'}
          </button>
          {error && (
            <span className="text-xs text-red-400">{error}</span>
          )}
        </div>
      )}
    </div>
  )
}
