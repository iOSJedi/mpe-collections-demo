'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { SupplierSummary } from '@/types'
import { apiFetch } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'

const TYPE_BADGE: Record<string, string> = {
  DIRECT: 'bg-blue-100 text-blue-800',
  CONTRACTOR: 'bg-purple-100 text-purple-800',
  SERVICE: 'bg-teal-100 text-teal-800',
  CONSULTANT: 'bg-amber-100 text-amber-800',
}

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  INACTIVE: 'bg-gray-100 text-gray-500',
  SUSPENDED: 'bg-red-100 text-red-700',
  BLACKLISTED: 'bg-red-200 text-red-900',
}

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}

export function SupplierList() {
  const router = useRouter()

  const [suppliers, setSuppliers] = useState<SupplierSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [typeFilter, setTypeFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  const fetchSuppliers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (typeFilter) params.set('type', typeFilter)
      if (categoryFilter) params.set('category', categoryFilter)
      if (search) params.set('search', search)
      params.set('limit', '50')

      const res = await apiFetch(`/api/payable?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to load suppliers')
      const data: SupplierSummary[] = await res.json()
      setSuppliers(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [typeFilter, categoryFilter, search])

  useEffect(() => {
    fetchSuppliers()
  }, [fetchSuppliers])

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') setSearch(searchInput)
  }

  const hasFilters = typeFilter || categoryFilter || search

  return (
    <div className="space-y-4">
      {/* Filters bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Categories</option>
          <option value="Construction">Construction</option>
          <option value="Facilities">Facilities</option>
          <option value="IT">IT</option>
          <option value="Utilities">Utilities</option>
          <option value="Professional Services">Professional Services</option>
          <option value="Supplies">Supplies</option>
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Types</option>
          <option value="DIRECT">Direct</option>
          <option value="CONTRACTOR">Contractor</option>
          <option value="SERVICE">Service</option>
          <option value="CONSULTANT">Consultant</option>
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
          {hasFilters && (
            <button
              onClick={() => {
                setTypeFilter('')
                setCategoryFilter('')
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
                <th className="text-left px-4 py-3 font-medium text-slate-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Category</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Type</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Total Payable</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Open POs</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Blocked</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    Loading suppliers...
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
              {!loading && !error && suppliers.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    No suppliers found.
                  </td>
                </tr>
              )}
              {!loading && !error && suppliers.map((s) => (
                <tr
                  key={s.supplier_id}
                  onClick={() => router.push(`/payable/${s.supplier_id}`)}
                  className="hover:bg-blue-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">
                    {s.name}
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {s.category}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge
                      label={s.type}
                      className={TYPE_BADGE[s.type] ?? 'bg-slate-100 text-slate-700'}
                    />
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-800 whitespace-nowrap">
                    {formatCurrency(s.total_payable)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700 whitespace-nowrap">
                    {s.open_pos}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {s.blocked_invoices > 0 ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                        {s.blocked_invoices}
                      </span>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge
                      label={s.status}
                      className={STATUS_BADGE[s.status] ?? 'bg-slate-100 text-slate-700'}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && !error && suppliers.length > 0 && (
          <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500">
            Showing {suppliers.length} supplier{suppliers.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  )
}
