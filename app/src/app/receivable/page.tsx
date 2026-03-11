'use client'
import { CustomerList } from '@/components/receivable/CustomerList'

export default function ReceivablePage() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Customer Accounts</h1>
      <CustomerList />
    </div>
  )
}
