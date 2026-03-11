'use client'
import { SupplierList } from '@/components/payable/SupplierList'

export default function PayablePage() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Supplier Accounts</h1>
      <SupplierList />
    </div>
  )
}
