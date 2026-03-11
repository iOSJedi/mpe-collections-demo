'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { CustomerSummary } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { apiFetch } from '@/lib/api'

const TYPE_LABELS: Record<string, string> = {
  TENANT: 'Tenant',
  PROPERTY_MANAGER: 'Property Manager',
}

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

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'bg-slate-100 text-slate-700',
  INACTIVE: 'bg-gray-100 text-gray-500',
  SUSPENDED: 'bg-red-100 text-red-700',
}

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}

export function CustomerList() {
  const router = useRouter()

  const [customers, setCustomers] = useState<CustomerSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (typeFilter) params.set('type', typeFilter)
      if (statusFilter) params.set('status', statusFilter)
      if (search) params.set('search', search)
      params.set('limit', '50')

      const res = await apiFetch(`/api/receivable?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to load customers')
      const data: CustomerSummary[] = await res.json()
      setCustomers(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [typeFilter, statusFilter, search])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  // Debounce search: commit on Enter or blur
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') setSearch(searchInput)
  }

  return (
    <div className="space-y-4">
      {/* Filters bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Types</option>
          <option value="TENANT">Tenant</option>
          <option value="PROPERTY_MANAGER">Property Manager</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="SUSPENDED">Suspended</option>
        </select>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search by name..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            onBlur={() => setSearch(searchInput)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => setSearch(searchInput)}
            className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Search
          </button>
          {(typeFilter || statusFilter || search) && (
            <button
              onClick={() => {
                setTypeFilter('')
                setStatusFilter('')
                setSearchInput('')
                setSearch('')
              }}
              className="px-3 py-2 text-sm text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Account #</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Type</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Property</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Total Receivable</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Overdue</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Risk Level</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    Loading customers...
                  </td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-red-500">
                    {error}
                  </td>
                </tr>
              )}
              {!loading && !error && customers.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    No customers found.
                  </td>
                </tr>
              )}
              {!loading && !error && customers.map((c) => (
                <tr
                  key={c.customer_id}
                  onClick={() => router.push(`/receivable/${c.customer_id}`)}
                  className="hover:bg-blue-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs whitespace-nowrap">
                    {c.account_number}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">
                    {c.name}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge
                      label={TYPE_LABELS[c.type] ?? c.type}
                      className={TYPE_BADGE[c.type] ?? 'bg-slate-100 text-slate-700'}
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-600 max-w-[180px] truncate">
                    {c.property_name ?? <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-800 whitespace-nowrap">
                    {formatCurrency(c.total_receivable)}
                  </td>
                  <td className={`px-4 py-3 text-right font-medium whitespace-nowrap ${c.overdue_amount > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                    {c.overdue_amount > 0 ? formatCurrency(c.overdue_amount) : '—'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {c.delinquency_risk ? (
                      <Badge
                        label={c.delinquency_risk}
                        className={RISK_BADGE[c.delinquency_risk] ?? 'bg-slate-100 text-slate-700'}
                      />
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge
                      label={c.status}
                      className={STATUS_BADGE[c.status] ?? 'bg-slate-100 text-slate-700'}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer with count */}
        {!loading && !error && customers.length > 0 && (
          <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500">
            Showing {customers.length} customer{customers.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  )
}
