'use client'

import { useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import type { CreditLedgerEntry, CustomerBreakdown, InvoiceBreakdownItem } from '@/types'
import { apiFetch } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'

// ─── Types ─────────────────────────────────────────────────────────────────

interface CreditData {
  creditBalance: number
  entries: CreditLedgerEntry[]
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function entryTypeStyle(type: CreditLedgerEntry['type']): string {
  switch (type) {
    case 'CREDIT': return 'text-green-400'
    case 'DEBIT':  return 'text-amber-400'
    case 'REFUND': return 'text-red-400'
    default:       return 'text-slate-400'
  }
}

function formatTimestamp(ts: string): string {
  try {
    return new Date(ts).toLocaleString('en-PH', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return ts
  }
}

// ─── Apply Dialog ───────────────────────────────────────────────────────────

function ApplyDialog({
  customerId,
  creditBalance,
  onSuccess,
}: {
  customerId: number
  creditBalance: number
  onSuccess: () => void
}) {
  const [open, setOpen] = useState(false)
  const [invoices, setInvoices] = useState<InvoiceBreakdownItem[]>([])
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | ''>('')
  const [amount, setAmount] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    apiFetch(`/api/receivable/${customerId}/breakdown`)
      .then(r => r.ok ? r.json() as Promise<CustomerBreakdown> : Promise.reject())
      .then(data => {
        const outstanding = data.invoices.filter(inv => inv.status !== 'PAID')
        setInvoices(outstanding)
        if (outstanding.length > 0) {
          setSelectedInvoiceId(outstanding[0].invoiceId)
          setAmount(String(Math.min(creditBalance, outstanding[0].balanceRemaining)))
        }
      })
      .catch(() => setError('Failed to load invoices'))
  }, [open, customerId, creditBalance])

  function handleInvoiceChange(invoiceId: number) {
    setSelectedInvoiceId(invoiceId)
    const inv = invoices.find(i => i.invoiceId === invoiceId)
    if (inv) {
      setAmount(String(Math.min(creditBalance, inv.balanceRemaining)))
    }
  }

  async function handleApply() {
    if (!selectedInvoiceId || !amount) return
    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid amount')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch(`/api/credit/${customerId}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: selectedInvoiceId, amount: parsedAmount }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error ?? 'Failed to apply credit')
        return
      }
      setOpen(false)
      onSuccess()
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          disabled={creditBalance <= 0}
          className="flex-1 px-3 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
        >
          Apply to Invoice
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-[#0d1b2e] border border-[#1a5a8a] rounded-xl p-6 space-y-5 shadow-2xl">
          <Dialog.Title className="text-lg font-semibold text-white">
            Apply Credit to Invoice
          </Dialog.Title>
          <Dialog.Description className="text-sm text-slate-400">
            Available credit: <span className="text-blue-400 font-semibold">{formatCurrency(creditBalance)}</span>
          </Dialog.Description>

          {invoices.length === 0 && !error && (
            <p className="text-sm text-slate-400 text-center py-3">Loading invoices…</p>
          )}

          {invoices.length > 0 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Select Invoice</label>
                <select
                  value={selectedInvoiceId}
                  onChange={e => handleInvoiceChange(Number(e.target.value))}
                  className="w-full bg-[#0a1422] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                >
                  {invoices.map(inv => (
                    <option key={inv.invoiceId} value={inv.invoiceId}>
                      {inv.invoiceNumber} — {formatCurrency(inv.balanceRemaining)} due
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Amount (PHP)</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={Math.min(
                    creditBalance,
                    invoices.find(i => i.invoiceId === selectedInvoiceId)?.balanceRemaining ?? creditBalance
                  )}
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="w-full bg-[#0a1422] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex gap-3 pt-2">
            <Dialog.Close asChild>
              <button className="flex-1 px-3 py-2 rounded-lg text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors">
                Cancel
              </button>
            </Dialog.Close>
            <button
              onClick={handleApply}
              disabled={loading || !selectedInvoiceId || !amount || invoices.length === 0}
              className="flex-1 px-3 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
            >
              {loading ? 'Applying…' : 'Confirm Apply'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ─── Refund Confirm ─────────────────────────────────────────────────────────

function RefundButton({
  customerId,
  creditBalance,
  onSuccess,
}: {
  customerId: number
  creditBalance: number
  onSuccess: () => void
}) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState<string>(String(creditBalance))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) setAmount(String(creditBalance))
  }, [open, creditBalance])

  async function handleRefund() {
    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid amount')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch(`/api/credit/${customerId}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parsedAmount }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error ?? 'Failed to issue refund')
        return
      }
      setOpen(false)
      onSuccess()
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          disabled={creditBalance <= 0}
          className="flex-1 px-3 py-2 rounded-lg text-sm font-medium bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 transition-colors"
        >
          Refund
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm bg-[#0d1b2e] border border-[#1a5a8a] rounded-xl p-6 space-y-5 shadow-2xl">
          <Dialog.Title className="text-lg font-semibold text-white">
            Issue Refund
          </Dialog.Title>
          <Dialog.Description className="text-sm text-slate-400">
            Available credit: <span className="text-blue-400 font-semibold">{formatCurrency(creditBalance)}</span>
          </Dialog.Description>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Refund Amount (PHP)</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              max={creditBalance}
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full bg-[#0a1422] border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex gap-3 pt-2">
            <Dialog.Close asChild>
              <button className="flex-1 px-3 py-2 rounded-lg text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors">
                Cancel
              </button>
            </Dialog.Close>
            <button
              onClick={handleRefund}
              disabled={loading || !amount}
              className="flex-1 px-3 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
            >
              {loading ? 'Processing…' : 'Confirm Refund'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ─── Main component ─────────────────────────────────────────────────────────

export function CreditBalanceCard({ customerId }: { customerId: number }) {
  const [data, setData] = useState<CreditData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function load() {
    setLoading(true)
    setError(null)
    apiFetch(`/api/credit/${customerId}`)
      .then(r => r.ok ? r.json() as Promise<CreditData> : r.json().then(b => Promise.reject(b?.error ?? 'Failed')))
      .then(d => setData(d))
      .catch(err => setError(typeof err === 'string' ? err : 'Failed to load credit balance'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [customerId]) // eslint-disable-line react-hooks/exhaustive-deps

  const hasBalance = data && data.creditBalance > 0
  const latestCredit = data?.entries.find(e => e.type === 'CREDIT')

  return (
    <div
      className={`rounded-xl border p-5 space-y-4 transition-opacity ${
        hasBalance
          ? 'bg-[#0a1a2e] border-[#1a5a8a]'
          : 'bg-[#0a1422] border-slate-800 opacity-60'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
          Credit Balance
        </h2>
        {loading && (
          <span className="text-xs text-slate-500">Loading…</span>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}

      {!loading && data && (
        <>
          {/* Balance amount */}
          <div>
            <p
              className="text-3xl font-bold"
              style={{ color: hasBalance ? '#60a5fa' : '#475569' }}
            >
              {formatCurrency(data.creditBalance)}
            </p>
            {latestCredit?.description && (
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                {latestCredit.description}
              </p>
            )}
            {!hasBalance && (
              <p className="text-xs text-slate-500 mt-1">No credit balance</p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <ApplyDialog
              customerId={customerId}
              creditBalance={data.creditBalance}
              onSuccess={load}
            />
            <RefundButton
              customerId={customerId}
              creditBalance={data.creditBalance}
              onSuccess={load}
            />
          </div>

          {/* History log */}
          {data.entries.length > 0 && (
            <div className="border-t border-slate-800 pt-4 space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Credit History
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {data.entries.map(entry => (
                  <div
                    key={entry.entryId}
                    className="flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`shrink-0 font-semibold uppercase ${entryTypeStyle(entry.type)}`}
                      >
                        {entry.type}
                      </span>
                      <span className="text-slate-400 truncate">
                        {entry.description ?? '—'}
                      </span>
                    </div>
                    <div className="shrink-0 text-right space-y-0.5">
                      <p className="font-medium text-slate-200">
                        {formatCurrency(entry.amount)}
                      </p>
                      <p className="text-slate-600">
                        {formatTimestamp(entry.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.entries.length === 0 && (
            <p className="text-xs text-slate-600 text-center pb-1">No credit history</p>
          )}
        </>
      )}
    </div>
  )
}
