'use client'

import { useState } from 'react'
import { formatCurrency } from '@/lib/utils'

interface MatchDetailProps {
  match: {
    match_id: number
    po_number: string
    supplier_name: string
    project_name: string
    po_amount: number
    receipt_amount: number
    invoice_amount: number
    match_status: string
    payment_status: string
    discrepancies: { field: string; expected: string; actual: string; severity: string }[] | null
    ai_notes: string | null
    // Extended fields (may be present from API)
    po_description?: string | null
    po_issued_date?: string | null
    invoice_number?: string | null
    invoice_submitted_date?: string | null
    invoice_due_date?: string | null
  }
  onClose: () => void
  onAction: (matchId: number, action: 'APPROVE' | 'BLOCK') => Promise<void>
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{title}</h4>
  )
}

function DataRow({ label, value, highlight }: { label: string; value: string | number | null | undefined; highlight?: boolean }) {
  return (
    <div className={`flex justify-between py-1.5 border-b border-slate-50 last:border-0 ${highlight ? 'text-red-600' : ''}`}>
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-xs font-medium ${highlight ? 'text-red-600' : 'text-slate-800'}`}>
        {value ?? <span className="text-slate-300">—</span>}
      </span>
    </div>
  )
}

export function MatchDetail({ match, onClose, onAction }: MatchDetailProps) {
  const [acting, setActing] = useState<'APPROVE' | 'BLOCK' | null>(null)

  const handleAction = async (action: 'APPROVE' | 'BLOCK') => {
    setActing(action)
    try {
      await onAction(match.match_id, action)
      onClose()
    } finally {
      setActing(null)
    }
  }

  const amountMismatch = match.invoice_amount !== match.po_amount

  return (
    // Overlay
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />

      {/* Slide-out panel */}
      <div className="relative z-10 w-full max-w-3xl bg-white shadow-2xl flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900">3-Way Match Review</h3>
            <p className="text-xs text-slate-500 mt-0.5">PO {match.po_number} · {match.supplier_name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl leading-none"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Three columns */}
          <div className="grid grid-cols-3 gap-4">
            {/* Purchase Order */}
            <div className="bg-slate-50 rounded-lg p-4">
              <SectionHeader title="Purchase Order" />
              <DataRow label="PO #" value={match.po_number} />
              <DataRow label="Project" value={match.project_name} />
              <DataRow label="Issued Date" value={match.po_issued_date} />
              <DataRow label="Description" value={match.po_description} />
              <DataRow
                label="Amount"
                value={formatCurrency(match.po_amount)}
              />
            </div>

            {/* Goods Receipt */}
            <div className="bg-slate-50 rounded-lg p-4">
              <SectionHeader title="Goods Receipt" />
              <DataRow label="Supplier" value={match.supplier_name} />
              <DataRow
                label="Amount"
                value={formatCurrency(match.receipt_amount)}
                highlight={match.receipt_amount !== match.po_amount}
              />
              <p className="text-xs text-slate-400 mt-2 italic">
                See goods receipt record for full details
              </p>
            </div>

            {/* Supplier Invoice */}
            <div className="bg-slate-50 rounded-lg p-4">
              <SectionHeader title="Supplier Invoice" />
              <DataRow label="Invoice #" value={match.invoice_number} />
              <DataRow label="Submitted" value={match.invoice_submitted_date} />
              <DataRow label="Due Date" value={match.invoice_due_date} />
              <DataRow
                label="Amount"
                value={formatCurrency(match.invoice_amount)}
                highlight={amountMismatch}
              />
            </div>
          </div>

          {/* Discrepancies */}
          {match.discrepancies && match.discrepancies.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-red-700 mb-3">Discrepancies</h4>
              <ul className="space-y-2">
                {match.discrepancies.map((d, i) => (
                  <li key={i} className="text-sm text-red-700 flex items-start gap-2">
                    <span className="text-red-400 mt-0.5">&#9679;</span>
                    <span>
                      <span className="font-medium">{d.field}:</span> Expected {d.expected}, got {d.actual}
                    </span>
                  </li>
                ))}
              </ul>
              {amountMismatch && !match.discrepancies.some(d => d.field.toLowerCase().includes('amount')) && (
                <li className="text-sm text-red-700 flex items-start gap-2 mt-2 list-none">
                  <span className="text-red-400 mt-0.5">&#9679;</span>
                  <span>
                    <span className="font-medium">Amount:</span> PO {formatCurrency(match.po_amount)} vs Invoice {formatCurrency(match.invoice_amount)}
                  </span>
                </li>
              )}
            </div>
          )}

          {/* Auto-generated amount mismatch note if no discrepancies array but amounts differ */}
          {amountMismatch && (!match.discrepancies || match.discrepancies.length === 0) && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-red-700 mb-2">Discrepancies</h4>
              <p className="text-sm text-red-700">
                Amount: PO {formatCurrency(match.po_amount)} vs Invoice {formatCurrency(match.invoice_amount)}
              </p>
            </div>
          )}

          {/* AI Notes */}
          {match.ai_notes && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-blue-700 mb-2">AI Analysis</h4>
              <p className="text-sm text-blue-800 leading-relaxed">{match.ai_notes}</p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
          <button
            onClick={onClose}
            className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2 border border-slate-200 rounded-lg bg-white transition-colors"
          >
            Cancel
          </button>
          <div className="flex gap-3">
            <button
              onClick={() => handleAction('BLOCK')}
              disabled={acting !== null}
              className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              {acting === 'BLOCK' ? 'Blocking...' : 'Block Invoice'}
            </button>
            <button
              onClick={() => handleAction('APPROVE')}
              disabled={acting !== null}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {acting === 'APPROVE' ? 'Releasing...' : 'Release for Payment'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
