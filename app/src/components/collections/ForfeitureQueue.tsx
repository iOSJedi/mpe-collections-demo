'use client'

import { useEffect, useState, useCallback } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import type { DepositForfeiture } from '@/types'
import { apiFetch } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type TabKey = 'pending' | 'approved' | 'rejected'

const TABS: { key: TabKey; label: string; status: string }[] = [
  { key: 'pending', label: 'Pending Approval', status: 'FLAGGED' },
  { key: 'approved', label: 'Approved', status: 'APPROVED' },
  { key: 'rejected', label: 'Rejected', status: 'REJECTED' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── Reject Dialog ────────────────────────────────────────────────────────────

function RejectDialog({
  forfeiture,
  onSuccess,
}: {
  forfeiture: DepositForfeiture
  onSuccess: () => void
}) {
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleReject() {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch(`/api/forfeitures/${forfeiture.forfeitureId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      })
      if (res.ok) {
        setOpen(false)
        setNotes('')
        onSuccess()
      } else {
        const body = await res.json().catch(() => ({}))
        setError(body?.error ?? 'Failed to reject forfeiture.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="px-3 py-1.5 text-xs font-medium rounded-lg border border-red-300 text-red-700 hover:bg-red-50 transition-colors">
          Reject
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-xl">
          <Dialog.Title className="text-base font-semibold text-slate-900">
            Reject Forfeiture
          </Dialog.Title>
          <Dialog.Description className="text-sm text-slate-500">
            Rejecting forfeiture of {formatCurrency(forfeiture.amount)} for{' '}
            <span className="font-medium text-slate-700">{forfeiture.customerName}</span>
            {forfeiture.invoiceNumber && (
              <> — invoice <span className="font-mono">{forfeiture.invoiceNumber}</span></>
            )}
          </Dialog.Description>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Rejection Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Enter reason for rejection…"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-red-400 resize-none"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <Dialog.Close asChild>
              <button className="flex-1 px-3 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
            </Dialog.Close>
            <button
              onClick={handleReject}
              disabled={loading}
              className="flex-1 px-3 py-2 text-sm font-medium rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white transition-colors"
            >
              {loading ? 'Rejecting…' : 'Confirm Reject'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ─── Forfeiture Card ─────────────────────────────────────────────────────────

function ForfeitureCard({
  forfeiture,
  onRefresh,
}: {
  forfeiture: DepositForfeiture
  onRefresh: () => void
}) {
  const [manualAmount, setManualAmount] = useState<string>(String(forfeiture.amount))
  const [approving, setApproving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isPending = forfeiture.status === 'FLAGGED'

  async function handleApprove() {
    setApproving(true)
    setError(null)
    const amount = parseFloat(manualAmount)
    try {
      const res = await apiFetch(`/api/forfeitures/${forfeiture.forfeitureId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: isNaN(amount) ? undefined : amount }),
      })
      if (res.ok) {
        onRefresh()
      } else {
        const body = await res.json().catch(() => ({}))
        setError(body?.error ?? 'Failed to approve forfeiture.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setApproving(false)
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 text-sm truncate">
            {forfeiture.customerName ?? `Customer #${forfeiture.customerId}`}
          </p>
          {forfeiture.propertyName && (
            <p className="text-xs text-slate-400 mt-0.5 truncate">{forfeiture.propertyName}</p>
          )}
        </div>
        <Badge
          label={forfeiture.status}
          className={
            forfeiture.status === 'APPROVED'
              ? 'bg-green-100 text-green-800'
              : forfeiture.status === 'FLAGGED'
              ? 'bg-amber-100 text-amber-800'
              : 'bg-red-100 text-red-800'
          }
        />
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        {forfeiture.invoiceNumber && (
          <>
            <span className="text-slate-400">Invoice</span>
            <span className="font-mono text-slate-700 truncate">{forfeiture.invoiceNumber}</span>
          </>
        )}
        <span className="text-slate-400">Forfeiture Amount</span>
        <span className="font-semibold text-slate-800">{formatCurrency(forfeiture.amount)}</span>
        {forfeiture.daysOverdue != null && (
          <>
            <span className="text-slate-400">Days Overdue</span>
            <span className={`font-medium ${forfeiture.daysOverdue > 30 ? 'text-red-600' : 'text-amber-600'}`}>
              {forfeiture.daysOverdue}d
            </span>
          </>
        )}
        {forfeiture.depositBalance != null && (
          <>
            <span className="text-slate-400">Deposit Balance</span>
            <span className="text-slate-700">{formatCurrency(forfeiture.depositBalance)}</span>
          </>
        )}
        {forfeiture.reviewedBy && (
          <>
            <span className="text-slate-400">Reviewed By</span>
            <span className="text-slate-700 truncate">{forfeiture.reviewedBy}</span>
          </>
        )}
        {forfeiture.reviewedAt && (
          <>
            <span className="text-slate-400">Reviewed At</span>
            <span className="text-slate-700">{formatDate(forfeiture.reviewedAt)}</span>
          </>
        )}
        {forfeiture.notes && (
          <>
            <span className="text-slate-400">Notes</span>
            <span className="text-slate-600 italic">{forfeiture.notes}</span>
          </>
        )}
      </div>

      {/* Actions (only for pending) */}
      {isPending && (
        <div className="border-t border-slate-100 pt-3 space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 whitespace-nowrap">Manual Amount</label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={manualAmount}
              onChange={(e) => setManualAmount(e.target.value)}
              className="flex-1 px-2 py-1 text-xs rounded border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#003B1F]"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleApprove}
              disabled={approving}
              className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
              style={{ backgroundColor: '#003B1F', color: '#fff' }}
            >
              {approving ? 'Approving…' : 'Approve Forfeiture'}
            </button>
            <RejectDialog forfeiture={forfeiture} onSuccess={onRefresh} />
          </div>
          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ForfeitureQueue() {
  const [activeTab, setActiveTab] = useState<TabKey>('pending')
  const [items, setItems] = useState<DepositForfeiture[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const currentTab = TABS.find((t) => t.key === activeTab)!

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch(`/api/forfeitures?status=${currentTab.status}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? 'Failed to load forfeitures')
      }
      const data: DepositForfeiture[] = await res.json()
      setItems(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [currentTab.status])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-[#003B1F] text-[#003B1F]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading && (
        <p className="text-sm text-slate-400 text-center py-8">Loading forfeitures…</p>
      )}

      {!loading && error && (
        <p className="text-sm text-red-500 text-center py-8">{error}</p>
      )}

      {!loading && !error && items.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-8">
          No {currentTab.label.toLowerCase()} forfeitures.
        </p>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((f) => (
            <ForfeitureCard key={f.forfeitureId} forfeiture={f} onRefresh={load} />
          ))}
        </div>
      )}
    </div>
  )
}
