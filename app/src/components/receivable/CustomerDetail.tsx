'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CustomerDetail as CustomerDetailType, ContractSummary, CustomerBreakdown, PaymentWithAllocations, DocumentRecord } from '@/types'
import { apiFetch } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { InvoiceBreakdown } from './InvoiceBreakdown'
import { PaymentAllocations } from './PaymentAllocations'
import { CreditBalanceCard } from './CreditBalanceCard'

// ─── Badge helpers ─────────────────────────────────────────────────────────

const RISK_BADGE: Record<string, string> = {
  LOW: 'bg-green-100 text-green-800',
  MEDIUM: 'bg-amber-100 text-amber-800',
  HIGH: 'bg-orange-100 text-orange-800',
  CRITICAL: 'bg-red-100 text-red-800',
}

const RISK_BAR: Record<string, string> = {
  LOW: 'bg-green-500',
  MEDIUM: 'bg-amber-500',
  HIGH: 'bg-orange-500',
  CRITICAL: 'bg-red-500',
}

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  INACTIVE: 'bg-gray-100 text-gray-500',
  SUSPENDED: 'bg-red-100 text-red-700',
  PAID: 'bg-green-100 text-green-800',
  PARTIAL: 'bg-blue-100 text-blue-800',
  PENDING: 'bg-amber-100 text-amber-800',
  OVERDUE: 'bg-red-100 text-red-800',
  CONFIRMED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-500',
}

const TYPE_BADGE: Record<string, string> = {
  TENANT: 'bg-green-100 text-green-800',
  PROPERTY_MANAGER: 'bg-blue-100 text-blue-800',
  LEASE: 'bg-blue-100 text-blue-800',
  CONCESSION: 'bg-purple-100 text-purple-800',
  SERVICE: 'bg-slate-100 text-slate-700',
}

const METHOD_BADGE: Record<string, string> = {
  BANK_TRANSFER: 'bg-blue-100 text-blue-800',
  GCash: 'bg-sky-100 text-sky-800',
  CHECK: 'bg-amber-100 text-amber-800',
  STRIPE: 'bg-violet-100 text-violet-800',
  CASH: 'bg-green-100 text-green-800',
}

function Badge({ label, className }: { label: string; className?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${className ?? 'bg-slate-100 text-slate-700'}`}>
      {label}
    </span>
  )
}

// ─── Sub-sections ─────────────────────────────────────────────────────────

function ContractsSection({ contracts }: { contracts: ContractSummary[] }) {
  const [open, setOpen] = useState(true)

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <span className="font-semibold text-slate-700 text-sm">
          Contracts ({contracts.length})
        </span>
        <span className="text-slate-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="overflow-x-auto">
          {contracts.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-6">No contracts found.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-white border-b border-slate-100">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-slate-500 whitespace-nowrap">Contract #</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-500">Type</th>
                  <th className="text-right px-4 py-2 font-medium text-slate-500 whitespace-nowrap">Monthly Amt</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-500 whitespace-nowrap">Start Date</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-500 whitespace-nowrap">End Date</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {contracts.map((c) => (
                  <tr key={c.contract_id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-mono text-xs text-slate-600 whitespace-nowrap">{c.contract_number}</td>
                    <td className="px-4 py-2">
                      <Badge label={c.type} className={TYPE_BADGE[c.type]} />
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-slate-800 whitespace-nowrap">
                      {formatCurrency(c.monthly_amount)}
                    </td>
                    <td className="px-4 py-2 text-slate-600 whitespace-nowrap">{c.start_date}</td>
                    <td className="px-4 py-2 text-slate-600 whitespace-nowrap">{c.end_date}</td>
                    <td className="px-4 py-2">
                      <Badge label={c.status} className={STATUS_BADGE[c.status]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────

export function CustomerDetail({ customerId }: { customerId: number }) {
  const router = useRouter()
  const [data, setData] = useState<CustomerDetailType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [breakdownPayments, setBreakdownPayments] = useState<PaymentWithAllocations[]>([])
  const [customerDocuments, setCustomerDocuments] = useState<DocumentRecord[]>([])

  useEffect(() => {
    if (!customerId || isNaN(customerId)) return
    setLoading(true)
    setError(null)

    Promise.all([
      apiFetch(`/api/receivable/${customerId}`).then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body?.error ?? 'Failed to load customer')
        }
        return res.json() as Promise<CustomerDetailType>
      }),
      apiFetch(`/api/receivable/${customerId}/breakdown`).then(async (res) => {
        if (!res.ok) return null
        return res.json() as Promise<CustomerBreakdown>
      }).catch(() => null),
      apiFetch(`/api/documents?customerId=${customerId}`).then(async (res) => {
        if (!res.ok) return []
        return res.json() as Promise<DocumentRecord[]>
      }).catch(() => []),
    ])
      .then(([customerData, breakdownData, docsData]) => {
        setData(customerData)
        if (breakdownData) {
          setBreakdownPayments(breakdownData.payments)
        }
        setCustomerDocuments(docsData)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unknown error'))
      .finally(() => setLoading(false))
  }, [customerId])

  if (loading) {
    return (
      <div className="p-6 text-center text-slate-400">Loading customer details...</div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <button
          onClick={() => router.push('/receivable')}
          className="text-sm text-blue-600 hover:underline mb-4 flex items-center gap-1"
        >
          ← Back to Customers
        </button>
        <p className="text-red-500">{error ?? 'Customer not found.'}</p>
      </div>
    )
  }

  const delinquencyPct = data.delinquency_score != null ? Math.round(data.delinquency_score * 100) : null

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => router.push('/receivable')}
        className="text-sm text-blue-600 hover:underline flex items-center gap-1"
      >
        ← Back to Customers
      </button>

      {/* Header + Risk sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Header card */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          {/* Name & badges */}
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-slate-900 leading-tight">{data.name}</h1>
              <p className="text-slate-400 font-mono text-xs mt-1">{data.account_number}</p>
            </div>
            <div className="flex flex-wrap gap-2 mt-1">
              <Badge
                label={data.type === 'PROPERTY_MANAGER' ? 'Property Manager' : 'Tenant'}
                className={TYPE_BADGE[data.type]}
              />
              <Badge
                label={data.status}
                className={STATUS_BADGE[data.status] ?? 'bg-slate-100 text-slate-700'}
              />
            </div>
          </div>

          {/* Property & unit */}
          {(data.property_name || data.unit_info) && (
            <div className="flex flex-wrap gap-4 text-sm text-slate-600">
              {data.property_name && (
                <span>
                  <span className="text-slate-400 text-xs uppercase tracking-wide mr-1">Property</span>
                  {data.property_name}
                </span>
              )}
              {data.unit_info && (
                <span>
                  <span className="text-slate-400 text-xs uppercase tracking-wide mr-1">Unit</span>
                  {data.unit_info}
                </span>
              )}
            </div>
          )}

          {/* Contact info */}
          {(data.contact_person || data.email || data.phone) && (
            <div className="border-t border-slate-100 pt-3 flex flex-wrap gap-4 text-sm text-slate-600">
              {data.contact_person && (
                <span>
                  <span className="text-slate-400 text-xs uppercase tracking-wide mr-1">Contact</span>
                  {data.contact_person}
                </span>
              )}
              {data.email && (
                <a href={`mailto:${data.email}`} className="text-blue-600 hover:underline">
                  {data.email}
                </a>
              )}
              {data.phone && (
                <a href={`tel:${data.phone}`} className="text-slate-600 hover:underline">
                  {data.phone}
                </a>
              )}
            </div>
          )}

          {/* Totals */}
          <div className="border-t border-slate-100 pt-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide">Total Receivable</p>
              <p className="text-xl font-bold text-slate-900 mt-0.5">{formatCurrency(data.total_receivable)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide">Overdue Amount</p>
              <p className={`text-xl font-bold mt-0.5 ${data.overdue_amount > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                {data.overdue_amount > 0 ? formatCurrency(data.overdue_amount) : '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Risk sidebar */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <CreditBalanceCard customerId={customerId} />

          <h2 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">Risk & Segments</h2>

          {/* Delinquency score */}
          {delinquencyPct != null && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Delinquency Score</span>
                <span className="font-semibold text-slate-700">{delinquencyPct}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all ${RISK_BAR[data.delinquency_risk ?? ''] ?? 'bg-slate-400'}`}
                  style={{ width: `${delinquencyPct}%` }}
                />
              </div>
              {data.delinquency_risk && (
                <Badge
                  label={data.delinquency_risk}
                  className={RISK_BADGE[data.delinquency_risk]}
                />
              )}
            </div>
          )}

          {/* Credit risk */}
          {data.credit_risk_level && (
            <div className="space-y-1">
              <p className="text-xs text-slate-500">Credit Risk</p>
              <Badge label={data.credit_risk_level} className={RISK_BADGE[data.credit_risk_level]} />
            </div>
          )}

          {/* Payer segment */}
          {data.segment_name && (
            <div className="space-y-1">
              <p className="text-xs text-slate-500">Payer Segment</p>
              <Badge label={data.segment_name} className="bg-indigo-100 text-indigo-800" />
            </div>
          )}

          {/* Payment pattern */}
          {data.payment_pattern && (
            <div className="space-y-2 border-t border-slate-100 pt-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Payment Pattern</p>
              <div className="space-y-1 text-sm text-slate-700">
                {data.payment_pattern.avg_days_to_pay != null && (
                  <div className="flex justify-between">
                    <span className="text-slate-400 text-xs">Avg Days to Pay</span>
                    <span className="font-medium">{data.payment_pattern.avg_days_to_pay}d</span>
                  </div>
                )}
                {data.payment_pattern.preferred_method && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-xs">Preferred Method</span>
                    <Badge
                      label={data.payment_pattern.preferred_method}
                      className={METHOD_BADGE[data.payment_pattern.preferred_method] ?? 'bg-slate-100 text-slate-700'}
                    />
                  </div>
                )}
                {data.payment_pattern.typical_payment_day != null && (
                  <div className="flex justify-between">
                    <span className="text-slate-400 text-xs">Typical Pay Day</span>
                    <span className="font-medium">Day {data.payment_pattern.typical_payment_day}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {!data.delinquency_risk && !data.credit_risk_level && !data.segment_name && !data.payment_pattern && (
            <p className="text-xs text-slate-400 text-center py-2">No risk data available.</p>
          )}
        </div>
      </div>

      {/* Contracts */}
      <ContractsSection contracts={data.contracts} />

      {/* Invoice breakdown with penalty details */}
      <InvoiceBreakdown customerId={customerId} />

      {/* Payment history with allocation detail */}
      <PaymentAllocations
        payments={breakdownPayments}
        documents={customerDocuments}
        customerName={data.name}
      />
    </div>
  )
}
