'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { WorklistItem } from '@/types'
import { apiFetch } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'

const RISK_BADGE: Record<string, string> = {
  LOW: 'bg-green-100 text-green-800',
  MEDIUM: 'bg-amber-100 text-amber-800',
  HIGH: 'bg-orange-100 text-orange-800',
  CRITICAL: 'bg-red-100 text-red-800',
}

const TYPE_BADGE: Record<string, string> = {
  TENANT: 'bg-green-100 text-green-800',
  PROPERTY_MANAGER: 'bg-blue-100 text-blue-800',
}

const TYPE_LABELS: Record<string, string> = {
  TENANT: 'Tenant',
  PROPERTY_MANAGER: 'Property Mgr',
}

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  return new Date(dateStr).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })
}

type SortKey = 'total_overdue' | 'days_overdue'
type SortDir = 'asc' | 'desc'

export function Worklist() {
  const router = useRouter()
  const [items, setItems] = useState<WorklistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('total_overdue')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const fetchWorklist = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch('/api/collections/worklist')
      if (!res.ok) throw new Error('Failed to load worklist')
      const data: WorklistItem[] = await res.json()
      setItems(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchWorklist()
  }, [fetchWorklist])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sorted = [...items].sort((a, b) => {
    const aVal = a[sortKey]
    const bVal = b[sortKey]
    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
    if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <span className="ml-1 text-slate-300">↕</span>
    return <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  return (
    <div className="space-y-4">
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Customer</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Type</th>
                <th
                  className="text-right px-4 py-3 font-medium text-slate-600 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100"
                  onClick={() => handleSort('total_overdue')}
                >
                  Total Overdue <SortIcon col="total_overdue" />
                </th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Oldest Invoice</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Risk Level</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Last Payment</th>
                <th
                  className="text-right px-4 py-3 font-medium text-slate-600 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100"
                  onClick={() => handleSort('days_overdue')}
                >
                  Days Overdue <SortIcon col="days_overdue" />
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    Loading worklist...
                  </td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-red-500">
                    {error}
                  </td>
                </tr>
              )}
              {!loading && !error && sorted.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    No overdue accounts found.
                  </td>
                </tr>
              )}
              {!loading && !error && sorted.map((item) => (
                <tr
                  key={item.customer_id}
                  onClick={() => router.push(`/receivable/${item.customer_id}`)}
                  className="hover:bg-blue-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{item.name}</div>
                    <div className="text-xs text-slate-500 font-mono">{item.account_number}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge
                      label={TYPE_LABELS[item.type] ?? item.type}
                      className={TYPE_BADGE[item.type] ?? 'bg-slate-100 text-slate-700'}
                    />
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-red-600 whitespace-nowrap">
                    {formatCurrency(item.total_overdue)}
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {formatDate(item.oldest_invoice_date)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {item.risk_level ? (
                      <Badge
                        label={item.risk_level}
                        className={RISK_BADGE[item.risk_level] ?? 'bg-slate-100 text-slate-700'}
                      />
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {formatDate(item.last_payment_date)}
                  </td>
                  <td className={`px-4 py-3 text-right font-bold whitespace-nowrap ${item.days_overdue > 60 ? 'text-red-600' : 'text-slate-700'}`}>
                    {item.days_overdue}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && !error && sorted.length > 0 && (
          <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500">
            {sorted.length} account{sorted.length !== 1 ? 's' : ''} in collections
          </div>
        )}
      </div>
    </div>
  )
}
