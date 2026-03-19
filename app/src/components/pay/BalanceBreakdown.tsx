'use client'

import { InvoiceBreakdownItem } from '@/types'

interface BalanceBreakdownTotals {
  totalPrincipal: number
  totalPenalties: number
  totalPaid: number
  grandTotalDue: number
}

interface BalanceBreakdownProps {
  invoices: InvoiceBreakdownItem[]
  totals: BalanceBreakdownTotals
  onPayFull: () => void
  onPayPartial: () => void
}

function formatPHP(amount: number): string {
  return amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function getMonthLabel(billingPeriodStart: string): string {
  const date = new Date(billingPeriodStart)
  return date.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })
}

function getAgingTag(daysOverdue: number): { label: string; className: string } | null {
  if (daysOverdue <= 0) return null
  if (daysOverdue >= 90) return { label: '90+ days overdue', className: 'bg-red-100 text-red-700 border-red-200' }
  if (daysOverdue >= 60) return { label: '60+ days overdue', className: 'bg-orange-100 text-orange-700 border-orange-200' }
  if (daysOverdue >= 30) return { label: '30+ days overdue', className: 'bg-amber-100 text-amber-700 border-amber-200' }
  return { label: `${daysOverdue} days overdue`, className: 'bg-yellow-100 text-yellow-700 border-yellow-200' }
}

function getPenaltyMonthsLabel(penalties: InvoiceBreakdownItem['penalties'], penaltyRate?: number): string | null {
  const active = penalties.filter(p => p.status === 'ACTIVE')
  if (active.length === 0) return null
  const rate = penaltyRate ?? (active[0]?.penaltyRate ?? 2)
  return `${active.length}mo × ${rate}%`
}

export function BalanceBreakdown({ invoices, totals, onPayFull, onPayPartial }: BalanceBreakdownProps) {
  // Only show invoices with balance remaining or active penalties
  const outstanding = invoices.filter(
    inv => inv.balanceRemaining > 0 || inv.totalPenalties - inv.penaltiesPaid > 0
  )

  if (outstanding.length === 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-center">
          <p className="text-sm text-green-700 font-medium">No outstanding balance. Your account is up to date.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-[#003B1F] mb-1">Outstanding Invoices</h2>
        <p className="text-xs text-slate-500">Review your balance before making a payment</p>
      </div>

      {/* Invoice cards */}
      <div className="space-y-3">
        {outstanding.map((inv) => {
          const activePenaltyTotal = inv.totalPenalties - inv.penaltiesPaid
          const subtotal = inv.balanceRemaining + activePenaltyTotal
          const agingTag = getAgingTag(inv.daysOverdue)
          const penaltyLabel = getPenaltyMonthsLabel(inv.penalties, inv.penalties[0]?.penaltyRate)

          return (
            <div
              key={inv.invoiceId}
              className="rounded-lg border border-slate-200 bg-white p-4 space-y-3"
            >
              {/* Card header */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {getMonthLabel(inv.billingPeriodStart)}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">{inv.invoiceNumber}</p>
                </div>
                {agingTag && (
                  <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full border ${agingTag.className}`}>
                    {agingTag.label}
                  </span>
                )}
              </div>

              {/* Line items */}
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Rent</span>
                  <span className="text-slate-800 font-medium">₱{formatPHP(inv.balanceRemaining)}</span>
                </div>
                {activePenaltyTotal > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">
                      Late penalty
                      {penaltyLabel && (
                        <span className="ml-1 text-xs text-red-500">({penaltyLabel})</span>
                      )}
                    </span>
                    <span className="text-red-600 font-medium">+₱{formatPHP(activePenaltyTotal)}</span>
                  </div>
                )}
              </div>

              {/* Subtotal */}
              <div className="flex justify-between border-t border-slate-100 pt-2 text-sm">
                <span className="font-medium text-slate-700">Subtotal</span>
                <span className="font-bold text-slate-900">₱{formatPHP(subtotal)}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Total due box */}
      <div className="rounded-xl border-2 border-[#003B1F] bg-[#003B1F]/5 p-4 space-y-2">
        <div className="flex justify-between text-sm text-slate-600">
          <span>Principal</span>
          <span>₱{formatPHP(totals.totalPrincipal)}</span>
        </div>
        <div className="flex justify-between text-sm text-red-600">
          <span>Penalties</span>
          <span>+₱{formatPHP(totals.totalPenalties)}</span>
        </div>
        {totals.totalPaid > 0 && (
          <div className="flex justify-between text-sm text-green-600">
            <span>Payments received</span>
            <span>-₱{formatPHP(totals.totalPaid)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-[#003B1F]/20 pt-2">
          <span className="font-bold text-[#003B1F] text-base">Total Due</span>
          <span className="font-bold text-[#003B1F] text-xl">₱{formatPHP(totals.grandTotalDue)}</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="space-y-2.5 pt-1">
        <button
          onClick={onPayFull}
          className="w-full py-3 rounded-lg bg-[#003B1F] hover:bg-[#003B1F]/90 text-white text-sm font-semibold transition-colors shadow-sm"
        >
          Pay Full Amount — ₱{formatPHP(totals.grandTotalDue)}
        </button>
        <button
          onClick={onPayPartial}
          className="w-full py-3 rounded-lg border-2 border-[#003B1F] text-[#003B1F] hover:bg-[#003B1F]/5 text-sm font-semibold transition-colors"
        >
          Partial Payment
        </button>
      </div>
    </div>
  )
}
