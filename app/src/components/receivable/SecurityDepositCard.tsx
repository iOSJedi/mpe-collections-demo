'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import type { SecurityDeposit, DepositForfeiture } from '@/types'

interface DepositResponse {
  deposit: SecurityDeposit | null
  forfeitures: DepositForfeiture[]
}

const STATUS_BADGE: Record<string, string> = {
  APPROVED: 'bg-green-100 text-green-800',
  FLAGGED: 'bg-amber-100 text-amber-800',
  REJECTED: 'bg-red-100 text-red-800',
}

function Badge({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${className ?? 'bg-slate-100 text-slate-700'}`}
    >
      {label}
    </span>
  )
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })
}

export function SecurityDepositCard({ customerId }: { customerId: number }) {
  const [data, setData] = useState<DepositResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)
  const [applySuccess, setApplySuccess] = useState<string | null>(null)

  useEffect(() => {
    if (!customerId || isNaN(customerId)) return
    setLoading(true)
    apiFetch(`/api/deposits/${customerId}`)
      .then(async (res) => {
        if (!res.ok) return null
        return res.json() as Promise<DepositResponse>
      })
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [customerId])

  if (loading || !data || !data.deposit) return null

  const { deposit, forfeitures } = data

  const forfeitedTotal = forfeitures
    .filter((f) => f.status === 'APPROVED')
    .reduce((sum, f) => sum + f.amount, 0)

  const handleApplyFromDeposit = async () => {
    setApplyError(null)
    setApplySuccess(null)
    setApplying(true)
    try {
      const res = await apiFetch('/api/forfeitures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, depositId: deposit.depositId }),
      })
      if (res.ok) {
        setApplySuccess('Forfeiture flagged for review.')
        // Refresh data
        const refreshed = await apiFetch(`/api/deposits/${customerId}`)
        if (refreshed.ok) setData(await refreshed.json())
      } else {
        const body = await res.json().catch(() => ({}))
        setApplyError(body?.error ?? 'Failed to create forfeiture.')
      }
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
      <h2 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">
        Security Deposit
      </h2>

      {/* Three-column amounts */}
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Initial</p>
          <p className="font-semibold text-slate-800 text-sm">{formatCurrency(deposit.initialAmount)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Current</p>
          <p className="font-semibold text-slate-800 text-sm">{formatCurrency(deposit.currentBalance)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Forfeited</p>
          <p className={`font-semibold text-sm ${forfeitedTotal > 0 ? 'text-red-600' : 'text-slate-400'}`}>
            {forfeitedTotal > 0 ? formatCurrency(forfeitedTotal) : '—'}
          </p>
        </div>
      </div>

      {/* Forfeiture history */}
      {forfeitures.length > 0 && (
        <div className="border-t border-slate-100 pt-3 space-y-2">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">
            Forfeiture History
          </p>
          <div className="space-y-2">
            {forfeitures.map((f) => (
              <div
                key={f.forfeitureId}
                className="flex items-start justify-between gap-2 bg-slate-50 rounded-lg px-3 py-2"
              >
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-slate-800 text-xs">
                      {formatCurrency(f.amount)}
                    </span>
                    {f.invoiceNumber && (
                      <span className="font-mono text-xs text-slate-500">{f.invoiceNumber}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      label={f.status}
                      className={STATUS_BADGE[f.status]}
                    />
                    {f.reviewedBy && (
                      <span className="text-xs text-slate-400">{f.reviewedBy}</span>
                    )}
                    <span className="text-xs text-slate-400">{formatDate(f.flaggedAt)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Apply from Deposit button */}
      <div className="border-t border-slate-100 pt-3">
        <button
          onClick={handleApplyFromDeposit}
          disabled={applying || deposit.currentBalance <= 0}
          className="w-full px-3 py-2 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: '#003B1F', color: '#fff' }}
        >
          {applying ? 'Flagging…' : 'Apply from Deposit'}
        </button>
        {applyError && (
          <p className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
            {applyError}
          </p>
        )}
        {applySuccess && (
          <p className="mt-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1">
            {applySuccess}
          </p>
        )}
      </div>
    </div>
  )
}
