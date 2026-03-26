'use client'

import { useEffect, useState } from 'react'
import type { CustomerBreakdown, InvoiceBreakdownItem } from '@/types'
import { apiFetch } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'

// ─── Aging badge ────────────────────────────────────────────────────────────

function AgingBadge({ daysOverdue }: { daysOverdue: number }) {
  if (daysOverdue >= 90) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
        90+ DAYS OVERDUE
      </span>
    )
  }
  if (daysOverdue >= 60) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
        60 DAYS OVERDUE
      </span>
    )
  }
  if (daysOverdue >= 30) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
        30 DAYS OVERDUE
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
      PENDING
    </span>
  )
}

function agingBorderColor(daysOverdue: number): string {
  if (daysOverdue >= 90) return 'border-l-red-500'
  if (daysOverdue >= 60) return 'border-l-amber-500'
  if (daysOverdue >= 30) return 'border-l-amber-400'
  return 'border-l-blue-400'
}

// ─── Invoice card ────────────────────────────────────────────────────────────

function InvoiceCard({ inv }: { inv: InvoiceBreakdownItem }) {
  const borderColor = agingBorderColor(inv.daysOverdue)
  const monthsCount = inv.penalties.length
  const penaltyRate =
    inv.penalties.length > 0 ? `${Number(inv.penalties[0].penaltyRate).toFixed(1)}%` : null
  const penaltyLabel =
    monthsCount > 0 && penaltyRate
      ? `${monthsCount} mo × ${penaltyRate}`
      : null

  return (
    <div
      className={`bg-white border border-slate-200 border-l-4 ${borderColor} rounded-lg p-4 space-y-3`}
    >
      {/* Header row */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <span className="font-mono text-sm font-semibold text-slate-800">
            {inv.invoiceNumber}
          </span>
          <span className="ml-2 text-xs text-slate-400">{inv.contractNumber}</span>
          <p className="text-xs text-slate-400 mt-0.5">
            {inv.billingPeriodStart} – {inv.billingPeriodEnd}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400">Due {inv.dueDate}</span>
          <AgingBadge daysOverdue={inv.daysOverdue} />
        </div>
      </div>

      {/* 4-column breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
        <div className="space-y-0.5">
          <p className="text-xs text-slate-400 uppercase tracking-wide">Principal</p>
          <p className="text-sm font-semibold text-slate-800">{formatCurrency(inv.amount)}</p>
        </div>
        <div className="space-y-0.5">
          <p className="text-xs text-slate-400 uppercase tracking-wide">Penalty</p>
          <p className="text-sm font-semibold text-slate-800">
            {inv.totalPenalties > 0 ? formatCurrency(inv.totalPenalties) : '—'}
          </p>
          {penaltyLabel && (
            <p className="text-xs text-slate-400">{penaltyLabel}</p>
          )}
        </div>
        <div className="space-y-0.5">
          <p className="text-xs text-slate-400 uppercase tracking-wide">Paid</p>
          <p className="text-sm font-semibold text-green-600">
            {inv.penaltiesPaid > 0 || inv.amount - inv.balanceRemaining > 0
              ? formatCurrency((inv.amount - inv.balanceRemaining) + inv.penaltiesPaid)
              : '—'}
          </p>
        </div>
        <div className="space-y-0.5">
          <p className="text-xs text-slate-400 uppercase tracking-wide">Balance</p>
          <p
            className={`text-sm font-semibold ${
              inv.balanceRemaining > 0 || inv.totalPenalties - inv.penaltiesPaid > 0
                ? 'text-red-600'
                : 'text-slate-400'
            }`}
          >
            {inv.balanceRemaining + (inv.totalPenalties - inv.penaltiesPaid) > 0
              ? formatCurrency(inv.balanceRemaining + (inv.totalPenalties - inv.penaltiesPaid))
              : '—'}
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Summary bar ─────────────────────────────────────────────────────────────

function SummaryBar({
  totals,
}: {
  totals: CustomerBreakdown['totals']
}) {
  return (
    <div className="bg-slate-100 border border-slate-200 rounded-lg px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="space-y-0.5">
        <p className="text-xs text-slate-500 uppercase tracking-wide">Total Principal</p>
        <p className="text-sm font-bold text-slate-800">{formatCurrency(totals.totalPrincipal)}</p>
      </div>
      <div className="space-y-0.5">
        <p className="text-xs text-slate-500 uppercase tracking-wide">Total Penalties</p>
        <p className="text-sm font-bold text-amber-700">
          {totals.totalPenalties > 0 ? formatCurrency(totals.totalPenalties) : '—'}
        </p>
      </div>
      <div className="space-y-0.5">
        <p className="text-xs text-slate-500 uppercase tracking-wide">Total Paid</p>
        <p className="text-sm font-bold text-green-600">
          {totals.totalPaid > 0 ? formatCurrency(totals.totalPaid) : '—'}
        </p>
      </div>
      <div className="space-y-0.5">
        <p className="text-xs text-slate-500 uppercase tracking-wide">Grand Total Due</p>
        <p
          className={`text-sm font-bold ${
            totals.grandTotalDue > 0 ? 'text-red-600' : 'text-slate-400'
          }`}
        >
          {totals.grandTotalDue > 0 ? formatCurrency(totals.grandTotalDue) : '—'}
        </p>
      </div>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export function InvoiceBreakdown({ customerId }: { customerId: number }) {
  const [data, setData] = useState<CustomerBreakdown | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!customerId || isNaN(customerId)) return
    setLoading(true)
    setError(null)
    apiFetch(`/api/receivable/${customerId}/breakdown`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body?.error ?? 'Failed to load breakdown')
        }
        return res.json() as Promise<CustomerBreakdown>
      })
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Unknown error'))
      .finally(() => setLoading(false))
  }, [customerId])

  if (loading) {
    return (
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
          <span className="font-semibold text-slate-700 text-sm">Invoice Breakdown</span>
        </div>
        <p className="text-slate-400 text-sm text-center py-6">Loading invoice breakdown...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
          <span className="font-semibold text-slate-700 text-sm">Invoice Breakdown</span>
        </div>
        <p className="text-red-500 text-sm text-center py-6">{error ?? 'Failed to load breakdown.'}</p>
      </div>
    )
  }

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
        <span className="font-semibold text-slate-700 text-sm">
          Invoice Breakdown ({data.invoices.length})
        </span>
      </div>
      <div className="p-4 space-y-3">
        {data.invoices.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-4">No invoices found.</p>
        ) : (
          <>
            {data.invoices.map((inv) => (
              <InvoiceCard key={inv.invoiceId} inv={inv} />
            ))}
            <SummaryBar totals={data.totals} />
          </>
        )}
      </div>
    </div>
  )
}
