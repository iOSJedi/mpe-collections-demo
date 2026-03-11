'use client'

import { useEffect, useState } from 'react'
import { useAppDispatch } from '@/store'
import { setSelectedInvoice, setActiveTab } from '@/store/slices/emulatorSlice'
import { apiFetch } from '@/lib/api'
import { Badge } from '@/components/ui/badge'

interface Invoice {
  invoice_id: number
  invoice_number: string
  contract_number: string
  billing_period_start: string
  billing_period_end: string
  due_date: string
  amount: number
  balance_remaining: number
  status: string
}

interface EmulatorInvoicesProps {
  customerId: number
}

function statusVariant(status: string): 'success' | 'warning' | 'destructive' | 'default' {
  switch (status) {
    case 'PAID': return 'success'
    case 'PENDING': return 'warning'
    case 'OVERDUE': return 'destructive'
    case 'PARTIAL': return 'default'
    default: return 'default'
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'PAID': return 'Paid'
    case 'PENDING': return 'Pending'
    case 'OVERDUE': return 'Overdue'
    case 'PARTIAL': return 'Partial'
    default: return status
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function EmulatorInvoices({ customerId }: EmulatorInvoicesProps) {
  const dispatch = useAppDispatch()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    apiFetch(`/api/invoices?customerId=${customerId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch invoices')
        return res.json()
      })
      .then((data) => {
        setInvoices(data)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [customerId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        Loading invoices...
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-4 text-sm text-destructive text-center">{error}</div>
    )
  }

  if (invoices.length === 0) {
    return (
      <div className="py-8 text-sm text-muted-foreground text-center">No invoices found.</div>
    )
  }

  return (
    <div className="space-y-3">
      {invoices.map((inv) => (
        <div
          key={inv.invoice_id}
          className="rounded-lg border border-border bg-white p-3 shadow-sm"
        >
          <div className="flex items-start justify-between gap-2 mb-1">
            <div>
              <span className="text-sm font-semibold text-foreground">{inv.invoice_number}</span>
              <span className="ml-2 text-xs text-muted-foreground">· {inv.contract_number}</span>
            </div>
            <Badge variant={statusVariant(inv.status)} className="shrink-0 text-xs">
              {statusLabel(inv.status)}
            </Badge>
          </div>

          <div className="text-xs text-muted-foreground mb-2">
            {formatDate(inv.billing_period_start)} – {formatDate(inv.billing_period_end)}
          </div>

          <div className="flex items-center justify-between text-xs mb-2">
            <span>
              Amount: <span className="font-medium text-foreground">{formatCurrency(inv.amount)}</span>
            </span>
            {inv.status !== 'PAID' && (
              <span>
                Balance: <span className="font-medium text-foreground">{formatCurrency(inv.balance_remaining)}</span>
              </span>
            )}
          </div>

          <div className="text-xs text-muted-foreground mb-3">
            Due: {formatDate(inv.due_date)}
          </div>

          {inv.status !== 'PAID' && (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  dispatch(setSelectedInvoice(inv.invoice_id))
                  dispatch(setActiveTab('qr'))
                }}
                className="flex-1 rounded border text-xs px-2 py-1.5 font-medium transition-colors hover:bg-[#C5A930]/10"
                style={{ borderColor: '#C5A930', color: '#C5A930' }}
              >
                Show QR
              </button>
              <button
                onClick={() => {
                  dispatch(setSelectedInvoice(inv.invoice_id))
                  dispatch(setActiveTab('upload'))
                }}
                className="flex-1 rounded border border-border text-xs px-2 py-1.5 font-medium text-muted-foreground transition-colors hover:bg-muted"
              >
                Upload Proof
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
