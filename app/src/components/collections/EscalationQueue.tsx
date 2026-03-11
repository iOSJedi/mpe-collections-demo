'use client'

import { useEffect, useState, useCallback } from 'react'
import { EscalationRecord } from '@/types'
import { EscalationReview } from './EscalationReview'
import { apiFetch } from '@/lib/api'

const STATUS_BADGE: Record<string, string> = {
  OPEN: 'bg-red-100 text-red-800',
  IN_REVIEW: 'bg-amber-100 text-amber-800',
  RESOLVED: 'bg-green-100 text-green-800',
  DISMISSED: 'bg-gray-100 text-gray-500',
}

const TYPE_BADGE: Record<string, string> = {
  AMOUNT_MISMATCH: 'bg-red-100 text-red-800',
  DATE_MISMATCH: 'bg-orange-100 text-orange-800',
  DUPLICATE: 'bg-purple-100 text-purple-800',
  UNREADABLE: 'bg-gray-100 text-gray-700',
  INVALID_DOCUMENT: 'bg-red-100 text-red-700',
  SUSPICIOUS: 'bg-yellow-100 text-yellow-800',
}

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${className}`}>
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

function truncate(str: string, max = 80): string {
  return str.length > max ? `${str.slice(0, max)}…` : str
}

export function EscalationQueue() {
  const [escalations, setEscalations] = useState<EscalationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [reviewing, setReviewing] = useState<EscalationRecord | null>(null)

  const fetchEscalations = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      const res = await apiFetch(`/api/escalations?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to load escalations')
      const data: EscalationRecord[] = await res.json()
      setEscalations(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchEscalations()
  }, [fetchEscalations])

  const handleUpdated = (updated: EscalationRecord) => {
    setEscalations(prev =>
      prev.map(e => (e.escalation_id === updated.escalation_id ? updated : e))
    )
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          <option value="OPEN">Open</option>
          <option value="IN_REVIEW">In Review</option>
          <option value="RESOLVED">Resolved</option>
          <option value="DISMISSED">Dismissed</option>
        </select>

        {statusFilter && (
          <button
            onClick={() => setStatusFilter('')}
            className="px-3 py-2 text-sm text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Customer</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Document</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Issue Type</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Description</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Assigned To</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Created</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">Loading escalations...</td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-red-500">{error}</td>
                </tr>
              )}
              {!loading && !error && escalations.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">No escalations found.</td>
                </tr>
              )}
              {!loading && !error && escalations.map((esc) => (
                <tr key={esc.escalation_id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">
                    {esc.customer_name}
                  </td>
                  <td className="px-4 py-3 text-slate-600 max-w-[140px] truncate text-xs font-mono" title={esc.file_name}>
                    {esc.file_name}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge
                      label={esc.type.replace(/_/g, ' ')}
                      className={TYPE_BADGE[esc.type] ?? 'bg-slate-100 text-slate-700'}
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-600 max-w-[220px]" title={esc.description}>
                    {truncate(esc.description)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge
                      label={esc.status.replace('_', ' ')}
                      className={STATUS_BADGE[esc.status] ?? 'bg-slate-100 text-slate-700'}
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">
                    {esc.assigned_to ?? <span className="text-slate-300">Unassigned</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">
                    {formatDate(esc.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setReviewing(esc)}
                      disabled={esc.status === 'RESOLVED' || esc.status === 'DISMISSED'}
                      className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && !error && escalations.length > 0 && (
          <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500">
            {escalations.length} escalation{escalations.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Review modal */}
      {reviewing && (
        <EscalationReview
          escalation={reviewing}
          onClose={() => setReviewing(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  )
}
