'use client'
import { IncomingPayments } from '@/components/receivable/IncomingPayments'

export default function IncomingPaymentsPage() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Incoming Payments</h1>
      <IncomingPayments />
    </div>
  )
}
