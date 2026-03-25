'use client'

import { Fragment, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { SupplierDetail as SupplierDetailType } from '@/types'
import { apiFetch } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { MilestoneProgress } from './MilestoneProgress'

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

const PO_STATUS_BADGE: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-800',
  CLOSED: 'bg-slate-100 text-slate-600',
  CANCELLED: 'bg-red-100 text-red-700',
  PARTIAL: 'bg-amber-100 text-amber-800',
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

function InfoItem({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs text-slate-500 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-slate-800">{value ?? <span className="text-slate-300">—</span>}</p>
    </div>
  )
}

interface Props {
  supplierId: number
}

export function SupplierDetail({ supplierId }: Props) {
  const router = useRouter()
  const [supplier, setSupplier] = useState<SupplierDetailType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedPoId, setExpandedPoId] = useState<number | null>(null)

  useEffect(() => {
    const fetch_ = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await apiFetch(`/api/payable/${supplierId}`)
        if (!res.ok) throw new Error('Failed to load supplier')
        const data: SupplierDetailType = await res.json()
        setSupplier(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    fetch_()
  }, [supplierId])

  if (loading) {
    return <div className="p-6 text-slate-400">Loading supplier...</div>
  }

  if (error || !supplier) {
    return <div className="p-6 text-red-500">{error ?? 'Supplier not found'}</div>
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => router.push('/payable')}
        className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
      >
        &larr; Back to Suppliers
      </button>

      {/* Header card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{supplier.name}</h2>
            <p className="text-sm text-slate-500 mt-1">{supplier.category}</p>
          </div>
          <div className="flex gap-2">
            <Badge
              label={supplier.type}
              className={TYPE_BADGE[supplier.type] ?? 'bg-slate-100 text-slate-700'}
            />
            <Badge
              label={supplier.status}
              className={STATUS_BADGE[supplier.status] ?? 'bg-slate-100 text-slate-700'}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-500 mb-1">Total Payable</p>
            <p className="text-lg font-bold text-slate-900">{formatCurrency(supplier.total_payable)}</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-500 mb-1">Open POs</p>
            <p className="text-lg font-bold text-slate-900">{supplier.open_pos}</p>
          </div>
          <div className={`rounded-lg p-3 ${supplier.blocked_invoices > 0 ? 'bg-red-50' : 'bg-slate-50'}`}>
            <p className="text-xs text-slate-500 mb-1">Blocked Invoices</p>
            <p className={`text-lg font-bold ${supplier.blocked_invoices > 0 ? 'text-red-600' : 'text-slate-900'}`}>
              {supplier.blocked_invoices}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-slate-100 pt-4">
          <InfoItem label="Contact Person" value={supplier.contact_person} />
          <InfoItem label="Email" value={supplier.email} />
          <InfoItem label="Phone" value={supplier.phone} />
          <InfoItem label="Tax ID" value={supplier.tax_id} />
        </div>
      </div>

      {/* Purchase Orders */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">Purchase Orders</h3>
          <p className="text-xs text-slate-500 mt-0.5">Last 20 purchase orders</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">PO #</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Project</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Amount</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Issued Date</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Expected Delivery</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {supplier.purchase_orders.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400">No purchase orders found.</td>
                </tr>
              )}
              {supplier.purchase_orders.map((po) => (
                <Fragment key={po.po_id}>
                  <tr
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => setExpandedPoId(expandedPoId === po.po_id ? null : po.po_id)}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">{po.po_number}</td>
                    <td className="px-4 py-3 text-slate-700 max-w-[200px] truncate">{po.project_name}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-800 whitespace-nowrap">
                      {formatCurrency(po.total_amount)}
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{po.issued_date}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {(po as { expected_delivery?: string | null }).expected_delivery ?? <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge
                        label={po.status}
                        className={PO_STATUS_BADGE[po.status] ?? 'bg-slate-100 text-slate-700'}
                      />
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                      {expandedPoId === po.po_id ? '▲ Hide' : '▼ Milestones'}
                    </td>
                  </tr>
                  {expandedPoId === po.po_id && (
                    <tr>
                      <td colSpan={7} className="px-6 pb-4 bg-slate-50">
                        <MilestoneProgress poId={po.po_id} poTotal={po.total_amount} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Supplier Invoices */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">Supplier Invoices</h3>
          <p className="text-xs text-slate-500 mt-0.5">Last 20 invoices</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Invoice #</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">PO #</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Amount</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Submitted</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Due Date</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Payment Status</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Amount Paid</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {supplier.recent_invoices.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400">No invoices found.</td>
                </tr>
              )}
              {supplier.recent_invoices.map((inv) => (
                <tr key={inv.supplier_invoice_id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">{inv.invoice_number}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">{inv.po_number}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-800 whitespace-nowrap">
                    {formatCurrency(inv.amount)}
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{inv.submitted_date}</td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{inv.due_date}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge
                      label={inv.payment_status}
                      className={PAYMENT_STATUS_BADGE[inv.payment_status] ?? 'bg-slate-100 text-slate-700'}
                    />
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600 whitespace-nowrap">
                    {formatCurrency((inv as { amount_paid?: number }).amount_paid ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
