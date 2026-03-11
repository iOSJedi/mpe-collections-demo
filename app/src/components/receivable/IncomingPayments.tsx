'use client'

import { useEffect, useState, useCallback } from 'react'
import { PaymentSummary } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { apiFetch } from '@/lib/api'

type PaymentRecord = PaymentSummary & { customer_name: string }

const METHOD_BADGE: Record<string, string> = {
  CARD: 'bg-blue-100 text-blue-800',
  BANK_TRANSFER: 'bg-green-100 text-green-800',
  CHECK: 'bg-amber-100 text-amber-800',
  QR: 'bg-purple-100 text-purple-800',
}

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  CONFIRMED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
}

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function IncomingPayments() {
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [methodFilter, setMethodFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  const fetchPayments = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (methodFilter) params.set('payment_method', methodFilter)
      if (statusFilter) params.set('status', statusFilter)
      if (fromDate) params.set('from', fromDate)
      if (toDate) params.set('to', toDate)
      if (search) params.set('search', search)
      params.set('limit', '50')

      const res = await apiFetch(`/api/receivable/payments?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to load payments')
      const data: PaymentRecord[] = await res.json()
      setPayments(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [methodFilter, statusFilter, fromDate, toDate, search])

  useEffect(() => {
    fetchPayments()
  }, [fetchPayments])

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') setSearch(searchInput)
  }

  const hasFilters = methodFilter || statusFilter || fromDate || toDate || search

  const clearFilters = () => {
    setMethodFilter('')
    setStatusFilter('')
    setFromDate('')
    setToDate('')
    setSearchInput('')
    setSearch('')
  }

  return (
    <div className="space-y-4">
      {/* Filters bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Methods</option>
          <option value="CARD">Card</option>
          <option value="BANK_TRANSFER">Bank Transfer</option>
          <option value="CHECK">Check</option>
          <option value="QR">QR</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="FAILED">Failed</option>
        </select>

        <div className="flex gap-2 items-center">
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            title="From date"
          />
          <span className="text-slate-400 text-sm">to</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            title="To date"
          />
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search by reference or customer..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            onBlur={() => setSearch(searchInput)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => setSearch(searchInput)}
            className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Search
          </button>
          {hasFilters && (
            <button
              onClick={clearFilters}
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
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Date</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Customer</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Invoice #</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Amount</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Method</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Reference #</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    Loading payments...
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
              {!loading && !error && payments.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    No payments found.
                  </td>
                </tr>
              )}
              {!loading && !error && payments.map((p) => (
                <tr key={p.payment_id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {formatDate(p.payment_date)}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900 max-w-[200px] truncate">
                    {p.customer_name}
                  </td>
                  <td className="px-4 py-3 text-slate-600 font-mono text-xs whitespace-nowrap">
                    {p.invoice_number}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-800 whitespace-nowrap">
                    {formatCurrency(p.amount)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge
                      label={p.payment_method}
                      className={METHOD_BADGE[p.payment_method] ?? 'bg-slate-100 text-slate-700'}
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-600 font-mono text-xs whitespace-nowrap">
                    {p.reference_number ?? <span className="text-slate-300 font-sans">—</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge
                      label={p.status}
                      className={STATUS_BADGE[p.status] ?? 'bg-slate-100 text-slate-700'}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && !error && payments.length > 0 && (
          <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500">
            Showing {payments.length} payment{payments.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  )
}
