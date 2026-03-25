'use client'

import { useEffect, useState, useCallback } from 'react'
import { apiFetch } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import type { POMilestone } from '@/types'

interface Props {
  poId: number
  poTotal: number
}

export function MilestoneProgress({ poId, poTotal }: Props) {
  const [milestones, setMilestones] = useState<POMilestone[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [payingId, setPayingId] = useState<number | null>(null)
  const [payMsg, setPayMsg] = useState<{ text: string; ok: boolean } | null>(null)

  const fetchMilestones = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch(`/api/payable/${poId}/milestones`)
      if (!res.ok) throw new Error('Failed to load milestones')
      const data: POMilestone[] = await res.json()
      setMilestones(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [poId])

  useEffect(() => {
    fetchMilestones()
  }, [fetchMilestones])

  async function handleRelease(milestoneId: number) {
    setPayingId(milestoneId)
    try {
      const res = await apiFetch(`/api/payable/${poId}/milestones/${milestoneId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentReference: `PAY-${Date.now()}` }),
      })
      if (res.ok) {
        setPayMsg({ text: 'Payment released.', ok: true })
        fetchMilestones()
      } else {
        const err = await res.json()
        setPayMsg({ text: err.error ?? 'Release failed.', ok: false })
      }
    } catch {
      setPayMsg({ text: 'Network error.', ok: false })
    } finally {
      setPayingId(null)
      setTimeout(() => setPayMsg(null), 4000)
    }
  }

  if (loading) {
    return (
      <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
        <p className="text-xs text-slate-400">Loading milestones…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mt-3 rounded-lg border border-red-100 bg-red-50 px-4 py-3">
        <p className="text-xs text-red-500">{error}</p>
      </div>
    )
  }

  if (milestones.length === 0) {
    return (
      <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
        <p className="text-xs text-slate-500 mb-1 font-medium">Milestones</p>
        <p className="text-xs text-slate-400">
          No milestones assigned.{' '}
          <span className="text-blue-500">Assign from a template in the template manager.</span>
        </p>
      </div>
    )
  }

  const paidAmount = milestones
    .filter((m) => m.status === 'PAID')
    .reduce((s, m) => s + m.amount, 0)
  const completedAmount = milestones
    .filter((m) => m.status === 'COMPLETED')
    .reduce((s, m) => s + m.amount, 0)
  const pendingAmount = milestones
    .filter((m) => m.status === 'PENDING')
    .reduce((s, m) => s + m.amount, 0)

  const totalBase = poTotal > 0 ? poTotal : milestones.reduce((s, m) => s + m.amount, 0)

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-white px-4 py-3 space-y-3">
      <p className="text-xs font-semibold text-slate-700">Milestones</p>

      {/* Stacked progress bar */}
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100">
        {milestones.map((m) => {
          const width = totalBase > 0 ? (m.amount / totalBase) * 100 : m.percentage
          const color =
            m.status === 'PAID'
              ? 'bg-green-500'
              : m.status === 'COMPLETED'
              ? 'bg-amber-400'
              : 'bg-slate-200'
          return (
            <div
              key={m.milestoneId}
              className={`${color} h-full transition-all`}
              style={{ width: `${width}%` }}
              title={`${m.label}: ${m.status}`}
            />
          )
        })}
      </div>

      {/* Milestone cards */}
      <div className="space-y-2">
        {milestones.map((m) => {
          const borderColor =
            m.status === 'PAID'
              ? 'border-l-green-500'
              : m.status === 'COMPLETED'
              ? 'border-l-amber-400'
              : 'border-l-slate-300'
          const badgeClass =
            m.status === 'PAID'
              ? 'bg-green-100 text-green-700'
              : m.status === 'COMPLETED'
              ? 'bg-amber-100 text-amber-700'
              : 'bg-slate-100 text-slate-500'

          return (
            <div
              key={m.milestoneId}
              className={`rounded border-l-4 ${borderColor} border border-slate-100 bg-slate-50 px-3 py-2`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-800 truncate">{m.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {m.percentage}% &mdash; {formatCurrency(m.amount)}
                  </p>
                  {m.status === 'PAID' && m.paymentReference && (
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Ref: {m.paymentReference}
                      {m.paidAt && (
                        <> &middot; {new Date(m.paidAt).toLocaleDateString()}</>
                      )}
                    </p>
                  )}
                  {m.status === 'COMPLETED' && m.completedAt && (
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Completed: {new Date(m.completedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${badgeClass}`}
                  >
                    {m.status}
                  </span>
                  {m.status === 'COMPLETED' && (
                    <button
                      onClick={() => handleRelease(m.milestoneId)}
                      disabled={payingId === m.milestoneId}
                      className="rounded bg-amber-500 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
                    >
                      {payingId === m.milestoneId ? 'Releasing…' : 'Release Payment'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Feedback message */}
      {payMsg && (
        <div
          className={`rounded px-3 py-1.5 text-xs font-medium ${
            payMsg.ok
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {payMsg.text}
        </div>
      )}

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-2">
        <div>
          <p className="text-[10px] text-slate-400">Paid</p>
          <p className="text-xs font-semibold text-green-600">{formatCurrency(paidAmount)}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-400">Ready to Release</p>
          <p className="text-xs font-semibold text-amber-600">{formatCurrency(completedAmount)}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-400">Remaining</p>
          <p className="text-xs font-semibold text-slate-600">{formatCurrency(pendingAmount)}</p>
        </div>
      </div>
    </div>
  )
}
