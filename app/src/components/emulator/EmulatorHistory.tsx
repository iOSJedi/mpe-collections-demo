'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'

interface PaymentRecord {
  payment_id: number
  invoice_number: string
  amount: number
  payment_method: string
  payment_date: string
  status: string
}

interface EmulatorHistoryProps {
  customerId: number
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function methodLabel(method: string): string {
  switch (method) {
    case 'QR': return 'QR'
    case 'BANK_TRANSFER': return 'Bank'
    case 'CREDIT_CARD': return 'Card'
    case 'CASH': return 'Cash'
    default: return method
  }
}

function statusVariant(status: string): 'success' | 'warning' | 'destructive' | 'default' {
  switch (status) {
    case 'CONFIRMED': return 'success'
    case 'PENDING': return 'warning'
    case 'FAILED': return 'destructive'
    default: return 'default'
  }
}

export function EmulatorHistory({ customerId }: EmulatorHistoryProps) {
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/receivable/payments?customerId=${customerId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch payment history')
        return res.json()
      })
      .then((data) => {
        setPayments(data)
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
        Loading history...
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-4 text-sm text-destructive text-center">{error}</div>
    )
  }

  if (payments.length === 0) {
    return (
      <div className="py-8 text-sm text-muted-foreground text-center">No payment history found.</div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border">
            <th className="py-2 px-1 text-left font-medium text-muted-foreground">Date</th>
            <th className="py-2 px-1 text-left font-medium text-muted-foreground">Invoice</th>
            <th className="py-2 px-1 text-right font-medium text-muted-foreground">Amount</th>
            <th className="py-2 px-1 text-center font-medium text-muted-foreground">Method</th>
            <th className="py-2 px-1 text-center font-medium text-muted-foreground">Status</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((p) => (
            <tr key={p.payment_id} className="border-b border-border last:border-0">
              <td className="py-2 px-1 text-muted-foreground whitespace-nowrap">
                {formatDate(p.payment_date)}
              </td>
              <td className="py-2 px-1 font-medium text-foreground">{p.invoice_number}</td>
              <td className="py-2 px-1 text-right font-medium text-foreground">
                {formatCurrency(p.amount)}
              </td>
              <td className="py-2 px-1 text-center">
                <Badge variant="secondary" className="text-xs">
                  {methodLabel(p.payment_method)}
                </Badge>
              </td>
              <td className="py-2 px-1 text-center">
                <Badge variant={statusVariant(p.status)} className="text-xs">
                  {p.status}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
