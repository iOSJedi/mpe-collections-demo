'use client'

import { useEffect, useState, useCallback } from 'react'
import type { ThreeWayMatchRow } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { apiFetch } from '@/lib/api'
import { MatchDetail } from './MatchDetail'

const MATCH_STATUS_BADGE: Record<string, string> = {
  FULL_MATCH: 'bg-green-100 text-green-800',
  PARTIAL_MATCH: 'bg-amber-100 text-amber-800',
  MISMATCH: 'bg-red-100 text-red-700',
  PENDING_REVIEW: 'bg-slate-100 text-slate-600',
  BLOCKED: 'bg-red-200 text-red-900',
}

const PAYMENT_STATUS_BADGE: Record<string, string> = {
  UNPAID: 'bg-amber-100 text-amber-800',
  PARTIAL: 'bg-blue-100 text-blue-800',
  PAID: 'bg-green-100 text-green-800',
  OVERDUE: 'bg-red-100 text-red-700',
}

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}

// Extended type including fields from the API
type MatchRow = ThreeWayMatchRow & {
  po_description?: string | null
  po_issued_date?: string | null
  invoice_number?: string | null
  invoice_submitted_date?: string | null
  invoice_due_date?: string | null
}

export function ThreeWayMatch() {
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [suppliers, setSuppliers] = useState<{ supplier_id: number; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [matchStatusFilter, setMatchStatusFilter] = useState('')
  const [supplierFilter, setSupplierFilter] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  const [selectedMatch, setSelectedMatch] = useState<MatchRow | null>(null)

  const fetchMatches = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (matchStatusFilter) params.set('match_status', matchStatusFilter)
      if (supplierFilter) params.set('supplier_id', supplierFilter)
      if (search) params.set('search', search)

      const res = await apiFetch(`/api/payable/matching?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to load matches')
      const data: MatchRow[] = await res.json()
      setMatches(data)

      // Build supplier dropdown from results (deduplicate)
      const seen = new Set<number>()
      const supplierList: { supplier_id: number; name: string }[] = []
      for (const m of data) {
        if (!seen.has(m.match_id)) {
          // We use match_id as key but supplier dedup by name
        }
      }
      // Fetch all suppliers for filter dropdown
      const suppRes = await apiFetch('/api/payable?limit=200')
      if (suppRes.ok) {
        const suppData = await suppRes.json()
        for (const s of suppData) {
          if (!seen.has(s.supplier_id)) {
            seen.add(s.supplier_id)
            supplierList.push({ supplier_id: s.supplier_id, name: s.name })
          }
        }
        setSuppliers(supplierList)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [matchStatusFilter, supplierFilter, search])

  useEffect(() => {
    fetchMatches()
  }, [fetchMatches])

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') setSearch(searchInput)
  }

  const handleAction = async (matchId: number, action: 'APPROVE' | 'BLOCK') => {
    const res = await apiFetch('/api/payable/matching', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId, action }),
    })
    if (!res.ok) throw new Error('Failed to update match')
    // Refresh list
    await fetchMatches()
  }

  const hasFilters = matchStatusFilter || supplierFilter || search

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={matchStatusFilter}
          onChange={(e) => setMatchStatusFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Match Statuses</option>
          <option value="FULL_MATCH">Full Match</option>
          <option value="PARTIAL_MATCH">Partial Match</option>
          <option value="MISMATCH">Mismatch</option>
          <option value="PENDING_REVIEW">Pending Review</option>
          <option value="BLOCKED">Blocked</option>
        </select>

        <select
          value={supplierFilter}
          onChange={(e) => setSupplierFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Suppliers</option>
          {suppliers.map((s) => (
            <option key={s.supplier_id} value={String(s.supplier_id)}>
              {s.name}
            </option>
          ))}
        </select>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search supplier..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            onBlur={() => setSearch(searchInput)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                setMatchStatusFilter('')
                setSupplierFilter('')
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
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">PO #</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Supplier</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Project</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600 whitespace-nowrap">PO Amount</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Receipt Amt</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Invoice Amt</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Match Status</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Payment</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-400">
                    Loading matches...
                  </td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-red-500">
                    {error}
                  </td>
                </tr>
              )}
              {!loading && !error && matches.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-400">
                    No matches found.
                  </td>
                </tr>
              )}
              {!loading && !error && matches.map((m) => {
                const invoiceMismatch = m.invoice_amount !== m.po_amount
                return (
                  <tr key={m.match_id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">
                      {m.po_number}
                    </td>
                    <td className="px-4 py-3 text-slate-700 max-w-[160px] truncate">
                      {m.supplier_name}
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-[160px] truncate">
                      {m.project_name}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-800 whitespace-nowrap">
                      {formatCurrency(m.po_amount)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-800 whitespace-nowrap">
                      {formatCurrency(m.receipt_amount)}
                    </td>
                    <td className={`px-4 py-3 text-right font-medium whitespace-nowrap ${invoiceMismatch ? 'text-red-600' : 'text-slate-800'}`}>
                      {formatCurrency(m.invoice_amount)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge
                        label={m.match_status.replace('_', ' ')}
                        className={MATCH_STATUS_BADGE[m.match_status] ?? 'bg-slate-100 text-slate-700'}
                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge
                        label={m.payment_status}
                        className={PAYMENT_STATUS_BADGE[m.payment_status] ?? 'bg-slate-100 text-slate-700'}
                      />
                    </td>
                    <td className="px-4 py-3">
                      {m.match_status !== 'FULL_MATCH' && (
                        <button
                          onClick={() => setSelectedMatch(m)}
                          className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                          Review
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {!loading && !error && matches.length > 0 && (
          <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500">
            Showing {matches.length} match{matches.length !== 1 ? 'es' : ''}
          </div>
        )}
      </div>

      {/* Match Detail panel */}
      {selectedMatch && (
        <MatchDetail
          match={selectedMatch}
          onClose={() => setSelectedMatch(null)}
          onAction={handleAction}
        />
      )}
    </div>
  )
}
